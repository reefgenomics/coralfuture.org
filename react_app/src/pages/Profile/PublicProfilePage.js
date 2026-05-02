import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { BoxArrowUpRight, Calendar, JournalText, PersonCircle } from 'react-bootstrap-icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from 'contexts/AuthContext';
import './ProfilePage.css';
import '../Projects/ProjectsPage.css';

const backendUrl = '';

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const ProfileLinks = ({ profile }) => {
  const builtInLinks = [
    { label: 'Website', url: profile.website },
    { label: 'Google Scholar', url: profile.google_scholar },
    { label: 'ResearchGate', url: profile.researchgate },
  ].filter((link) => link.url);
  const customLinks = Array.isArray(profile.links) ? profile.links : [];
  const links = [...builtInLinks, ...customLinks];

  if (links.length === 0) return null;

  return (
    <div className="mt-4">
      <h5>Links</h5>
      <div className="d-flex flex-column gap-2">
        {links.map((link, index) => (
          <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer">
            <BoxArrowUpRight className="me-2" />
            {link.label || link.url}
          </a>
        ))}
      </div>
    </div>
  );
};

const UserProjects = ({ projects, owner }) => {
  const navigate = useNavigate();
  const ownerName = [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || owner?.username || 'Unknown';

  if (!projects || projects.length === 0) {
    return (
      <Card className="border-0 shadow-sm mt-4">
        <Card.Body className="p-4 text-center text-muted">
          No projects yet.
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="mt-5">
      <h2 className="h4 mb-3">Projects</h2>
      <Row className="g-4">
        {projects.map((project) => (
          <Col key={project.id} md={6}>
            <Card
              className={`project-card h-100${project.cover_photo ? ' project-card-with-cover' : ''}`}
              style={project.cover_photo ? { '--project-cover-image': `url(${project.cover_photo})` } : undefined}
            >
              <Card.Body className="p-4 d-flex flex-column">
                <div className="d-flex align-items-start justify-content-between mb-3">
                  <div className="project-icon">
                    <JournalText size={24} className="text-primary" />
                  </div>
                  <Badge bg="light" text="primary" className="project-badge">
                    {project.publications_count || 0} Publications
                  </Badge>
                </div>
                <h5 className="project-title mb-3">{project.name}</h5>
                {project.description && <p className="project-description text-muted">{project.description}</p>}
                <div className="project-meta mb-4 mt-auto">
                  <div className="meta-item">
                    <Calendar size={16} className="text-muted me-2" />
                    <span className="text-muted">Created: {formatDate(project.registration_date)}</span>
                  </div>
                  <div className="meta-item owner-meta">
                    <PersonCircle size={16} className="text-muted owner-meta-icon" />
                    <div className="owner-meta-content">
                      <span className="owner-meta-label">Owner:</span>
                      <span className="owner-inline">
                        {owner?.profile_photo_url ? (
                          <img src={owner.profile_photo_url} alt="" className="owner-avatar" />
                        ) : (
                          <span className="owner-avatar owner-avatar-placeholder">
                            {ownerName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {ownerName}
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="outline-primary" className="w-100 project-button" onClick={() => navigate(`/project/${project.id}`)}>
                  View Project Details
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

const PublicProfilePage = () => {
  const { username } = useParams();
  const { authData } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${backendUrl}/api/public/users/${username}/`);
        if (!response.ok) throw new Error('Profile was not found.');
        setProfile(await response.json());
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const fullName = useMemo(() => {
    if (!profile) return username;
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || username;
  }, [profile, username]);

  const isOwner = authData.authenticated && authData.username === username;

  if (loading) {
    return (
      <div className="profile-page">
        <Container className="py-5 text-center">
          <Spinner animation="border" />
          <p className="mt-3">Loading profile...</p>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <Container className="py-5">
          <Alert variant="danger">{error}</Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={10}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4 p-md-5">
                <div className="d-flex flex-column flex-md-row align-items-md-center gap-4">
                  {profile.profile_photo_url ? (
                    <img src={profile.profile_photo_url} alt={fullName} className="profile-avatar" />
                  ) : (
                    <div className="profile-avatar-placeholder"><PersonCircle /></div>
                  )}
                  <div className="flex-grow-1">
                    <div className="d-flex flex-column flex-md-row gap-3 justify-content-between">
                      <div>
                        <h1 className="mb-2">{fullName}</h1>
                        <p className="text-muted mb-2">@{profile.username}</p>
                      </div>
                      {isOwner && (
                        <div>
                          <Button as={Link} to={`/users/${profile.username}/edit`} variant="primary">Edit profile</Button>
                        </div>
                      )}
                    </div>
                    {profile.position && <p className="mb-1">{profile.position}</p>}
                    {profile.affiliation && <p className="mb-1 fw-semibold">{profile.affiliation}</p>}
                    {[profile.department, profile.city, profile.country].filter(Boolean).length > 0 && (
                      <p className="text-muted mb-0">
                        {[profile.department, profile.city, profile.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {profile.description && (
                  <div className="mt-5">
                    <h5>About</h5>
                    <p className="mb-0">{profile.description}</p>
                  </div>
                )}

                {profile.orcid && (
                  <div className="mt-4">
                    <h5>ORCID</h5>
                    <p className="mb-0">{profile.orcid}</p>
                  </div>
                )}

                {Array.isArray(profile.research_interests) && profile.research_interests.length > 0 && (
                  <div className="mt-4">
                    <h5>Research interests</h5>
                    {profile.research_interests.map((item) => <span key={item} className="profile-chip">{item}</span>)}
                  </div>
                )}

                {Array.isArray(profile.expertise) && profile.expertise.length > 0 && (
                  <div className="mt-4">
                    <h5>Expertise</h5>
                    {profile.expertise.map((item) => <Badge key={item} bg="light" text="dark" className="me-2 mb-2">{item}</Badge>)}
                  </div>
                )}

                <ProfileLinks profile={profile} />
              </Card.Body>
            </Card>

            <UserProjects projects={profile.projects || []} owner={profile} />
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default PublicProfilePage;
