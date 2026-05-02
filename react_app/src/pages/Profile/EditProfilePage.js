import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, PersonCircle, PlusCircle, Trash } from 'react-bootstrap-icons';
import { AuthContext } from 'contexts/AuthContext';
import './ProfilePage.css';

const backendUrl = '';

const emptyProfile = {
  first_name: '',
  last_name: '',
  description: '',
  affiliation: '',
  department: '',
  position: '',
  city: '',
  country: '',
  orcid: '',
  website: '',
  google_scholar: '',
  researchgate: '',
  research_interests: [],
  expertise: [],
  links: [],
};

const getCsrfToken = () => {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
};

const createCroppedAvatar = (imageSrc, crop) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const scale = baseScale * crop.zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (canvas.width - width) / 2 + crop.x;
    const y = (canvas.height - height) / 2 + crop.y;

    ctx.drawImage(image, x, y, width, height);
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Could not crop avatar.'));
      else resolve(blob);
    }, 'image/jpeg', 0.9);
  };
  image.onerror = reject;
  image.src = imageSrc;
});

const TextListEditor = ({ label, placeholder, values, onChange }) => {
  const updateValue = (index, value) => {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const removeValue = (index) => {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      {values.map((value, index) => (
        <div className="d-flex gap-2 mb-2" key={`${label}-${index}`}>
          <Form.Control
            value={value}
            placeholder={placeholder}
            onChange={(event) => updateValue(index, event.target.value)}
          />
          <Button variant="outline-danger" onClick={() => removeValue(index)} aria-label={`Remove ${label}`}>
            <Trash />
          </Button>
        </div>
      ))}
      <Button variant="outline-primary" size="sm" onClick={() => onChange([...values, ''])}>
        <PlusCircle className="me-2" />
        Add {label.toLowerCase()}
      </Button>
    </Form.Group>
  );
};

const LinksEditor = ({ values, onChange }) => {
  const updateLink = (index, field, value) => {
    onChange(values.map((link, linkIndex) => (
      linkIndex === index ? { ...link, [field]: value } : link
    )));
  };

  const removeLink = (index) => {
    onChange(values.filter((_, linkIndex) => linkIndex !== index));
  };

  return (
    <Form.Group className="mb-4">
      <Form.Label>Links</Form.Label>
      <Form.Text className="d-block mb-2">
        Add each link separately, for example: Website, Google Scholar, lab page, dataset.
      </Form.Text>
      {values.map((link, index) => (
        <Row className="g-2 mb-2" key={`link-${index}`}>
          <Col md={4}>
            <Form.Control
              value={link.label || ''}
              placeholder="Label, e.g. Lab website"
              onChange={(event) => updateLink(index, 'label', event.target.value)}
            />
          </Col>
          <Col md={7}>
            <Form.Control
              value={link.url || ''}
              placeholder="https://..."
              onChange={(event) => updateLink(index, 'url', event.target.value)}
            />
          </Col>
          <Col md={1}>
            <Button variant="outline-danger" className="w-100" onClick={() => removeLink(index)} aria-label="Remove link">
              <Trash />
            </Button>
          </Col>
        </Row>
      ))}
      <Button variant="outline-primary" size="sm" onClick={() => onChange([...values, { label: '', url: '' }])}>
        <PlusCircle className="me-2" />
        Add link
      </Button>
    </Form.Group>
  );
};

const cleanList = (values) => values.map((value) => value.trim()).filter(Boolean);
const cleanLinks = (links) => links
  .map((link) => ({ label: (link.label || '').trim(), url: (link.url || '').trim() }))
  .filter((link) => link.url);

const EditProfilePage = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { authData, loading: authLoading, checkAuthentication } = useContext(AuthContext);
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [avatarSource, setAvatarSource] = useState('');
  const [avatarCrop, setAvatarCrop] = useState({ zoom: 1, x: 0, y: 0 });

  useEffect(() => {
    if (authLoading) return;
    if (!authData.authenticated) {
      navigate('/login', { state: { from: { pathname: `/users/${username || ''}/edit` } } });
      return;
    }
    if (username && username !== authData.username) {
      navigate(`/users/${username}`, { replace: true });
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/auth/profile/`, { credentials: 'include' });
        if (!response.ok) throw new Error('Could not load profile.');
        const data = await response.json();
        setProfile({
          ...emptyProfile,
          ...data,
          research_interests: data.research_interests || [],
          expertise: data.expertise || [],
          links: data.links || [],
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authData.authenticated, authData.username, authLoading, navigate, username]);

  const fullName = useMemo(() => (
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || authData.username
  ), [authData.username, profile.first_name, profile.last_name]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarSource(reader.result);
      setAvatarCrop({ zoom: 1, x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await fetch(`${backendUrl}/api/auth/csrf/`, { credentials: 'include' });
      const formData = new FormData();
      Object.entries(profile).forEach(([key, value]) => {
        if (['profile_photo', 'profile_photo_url', 'email', 'username', 'created_at', 'updated_at'].includes(key)) return;
        if (['links', 'research_interests', 'expertise'].includes(key)) return;
        formData.append(key, value || '');
      });
      formData.append('links', JSON.stringify(cleanLinks(profile.links)));
      formData.append('research_interests', JSON.stringify(cleanList(profile.research_interests)));
      formData.append('expertise', JSON.stringify(cleanList(profile.expertise)));

      if (avatarSource) {
        const blob = await createCroppedAvatar(avatarSource, avatarCrop);
        formData.append('profile_photo', blob, 'profile-avatar.jpg');
      }

      const response = await fetch(`${backendUrl}/api/auth/profile/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'X-CSRFToken': getCsrfToken() },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save profile.');
      setProfile({ ...emptyProfile, ...data });
      setAvatarSource('');
      await checkAuthentication(backendUrl);
      setMessage('Profile saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="profile-page">
        <Container className="py-5 text-center">
          <Spinner animation="border" />
          <p className="mt-3">Loading profile...</p>
        </Container>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Container className="py-5">
        <Row className="g-4">
          <Col lg={4}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4 text-center">
                {profile.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt={fullName} className="profile-avatar mb-3" />
                ) : (
                  <div className="profile-avatar-placeholder mx-auto mb-3"><PersonCircle /></div>
                )}
                <h3 className="mb-1">{fullName}</h3>
                <p className="text-muted mb-2">{profile.position || 'Researcher'}</p>
                {profile.affiliation && <p className="mb-3">{profile.affiliation}</p>}
                <Button as={Link} to={`/users/${authData.username}`} variant="outline-primary" size="sm">
                  View public profile
                </Button>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={8}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <h1 className="h3 mb-4">Edit profile</h1>
                {error && <Alert variant="danger">{error}</Alert>}
                {message && <Alert variant="success">{message}</Alert>}

                <Form onSubmit={handleSubmit}>
                  <Row>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>First name</Form.Label><Form.Control name="first_name" value={profile.first_name} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Last name</Form.Label><Form.Control name="last_name" value={profile.last_name} onChange={handleFieldChange} /></Form.Group></Col>
                  </Row>

                  <Form.Group className="mb-4">
                    <Form.Label><Camera className="me-2" />Profile photo</Form.Label>
                    <Form.Control type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarSelect} />
                    {avatarSource && (
                      <div className="mt-4">
                        <div className="avatar-crop-box">
                          <img
                            src={avatarSource}
                            alt="Avatar crop preview"
                            className="avatar-crop-image"
                            style={{ transform: `translate(${avatarCrop.x}px, ${avatarCrop.y}px) scale(${avatarCrop.zoom})` }}
                          />
                        </div>
                        <Row className="mt-3">
                          <Col md={4}><Form.Label>Zoom</Form.Label><Form.Range min="1" max="3" step="0.05" value={avatarCrop.zoom} onChange={(e) => setAvatarCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} /></Col>
                          <Col md={4}><Form.Label>Horizontal</Form.Label><Form.Range min="-160" max="160" value={avatarCrop.x} onChange={(e) => setAvatarCrop((c) => ({ ...c, x: Number(e.target.value) }))} /></Col>
                          <Col md={4}><Form.Label>Vertical</Form.Label><Form.Range min="-160" max="160" value={avatarCrop.y} onChange={(e) => setAvatarCrop((c) => ({ ...c, y: Number(e.target.value) }))} /></Col>
                        </Row>
                      </div>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={4} name="description" value={profile.description} onChange={handleFieldChange} /></Form.Group>
                  <Row>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Affiliation</Form.Label><Form.Control name="affiliation" value={profile.affiliation} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Department / lab</Form.Label><Form.Control name="department" value={profile.department} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Position</Form.Label><Form.Control name="position" value={profile.position} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={3}><Form.Group className="mb-3"><Form.Label>City</Form.Label><Form.Control name="city" value={profile.city} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={3}><Form.Group className="mb-3"><Form.Label>Country</Form.Label><Form.Control name="country" value={profile.country} onChange={handleFieldChange} /></Form.Group></Col>
                  </Row>

                  <Row>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>ORCID</Form.Label><Form.Control name="orcid" value={profile.orcid} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Website</Form.Label><Form.Control name="website" value={profile.website} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Google Scholar</Form.Label><Form.Control name="google_scholar" value={profile.google_scholar} onChange={handleFieldChange} /></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>ResearchGate</Form.Label><Form.Control name="researchgate" value={profile.researchgate} onChange={handleFieldChange} /></Form.Group></Col>
                  </Row>

                  <TextListEditor
                    label="Research interest"
                    placeholder="e.g. Coral bleaching"
                    values={profile.research_interests}
                    onChange={(values) => setProfile((current) => ({ ...current, research_interests: values }))}
                  />
                  <TextListEditor
                    label="Expertise"
                    placeholder="e.g. Thermal tolerance experiments"
                    values={profile.expertise}
                    onChange={(values) => setProfile((current) => ({ ...current, expertise: values }))}
                  />
                  <LinksEditor
                    values={profile.links}
                    onChange={(values) => setProfile((current) => ({ ...current, links: values }))}
                  />

                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save profile'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default EditProfilePage;
