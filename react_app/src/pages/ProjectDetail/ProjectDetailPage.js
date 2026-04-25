import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Table, Button, Spinner, Form, Modal, Alert } from 'react-bootstrap';
import {
  ArrowLeft,
  Calendar,
  Person,
  JournalText,
  Globe,
  FileText,
  BoxArrowUpRight,
  ThermometerHalf,
  PencilSquare,
  Trash2,
  Image,
  Link45deg
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ProjectDetailPage.css';
import { AuthContext } from '../../contexts/AuthContext';
import { UserCartContext } from '../../contexts/UserCartContext';

const getDoiUrl = (doi) => {
  if (!doi) return null;
  const s = String(doi).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://doi.org/${s.replace(/^https?:\/\/doi\.org\/?/i, '')}`;
};

const getCsrfToken = () => {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : null;
};

const CITATION_API = 'https://citation.doi.org/format';

const STATISTICS_COLUMN_ORDER = [
  'site',
  'species',
  'condition',
  'timepoint',
  'ed5',
  'ed50',
  'ed95',
  'meaned5',
  'meaned50',
  'meaned95',
  'sd',
  'sded5',
  'sded50',
  'sded95',
];

const normalizeStatisticsKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
const TEXT_STATISTICS_KEYS = new Set(['site', 'species', 'condition', 'timepoint']);

const formatStatisticsValue = (value, key) => {
  if (value == null || value === '') return '—';

  const normalizedKey = normalizeStatisticsKey(key);
  if (TEXT_STATISTICS_KEYS.has(normalizedKey)) return String(value);

  const numericValue = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value);
};

function normalizeDoi(doi) {
  if (!doi || typeof doi !== 'string') return null;
  let s = doi.trim();
  if (s.startsWith('http')) {
    const m = s.match(/doi\.org\/(.+)/i);
    if (m) s = decodeURIComponent(m[1].trim());
    else return null;
  }
  if (/^(no doi|n\/a|na|-)$/i.test(s)) return null;
  return s;
}

function parseApaCitation(text) {
  let title = null;
  let year = null;
  let authors = '';
  let journal = '';
  const yearMatch = text.match(/\((\d{4})\)/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    const beforeYear = text.slice(0, yearMatch.index).trim();
    authors = beforeYear.replace(/\.\s*$/, '').trim();
  }
  const afterYear = text.match(/\)\.\s+(.+)/s);
  if (afterYear) {
    const rest = afterYear[1].trim();
    const parts = rest.split(/\s*\.\s+/).filter((p) => p.trim() && !p.trim().toLowerCase().startsWith('http'));
    if (parts.length >= 1) title = parts[0].trim().replace(/\s*\.\s*$/, '');
    if (parts.length >= 2) journal = parts[1].trim().replace(/\s*\.\s*$/, '');
  }
  return { title, year, authors, journal };
}

async function fetchCitationByDoi(doi) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return null;
  const url = `${CITATION_API}?doi=${encodeURIComponent(normalized)}&style=apa&lang=en-US`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return parseApaCitation(text.trim());
}

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { authData, loading: authLoading } = useContext(AuthContext);
  const { addToCart } = useContext(UserCartContext);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editName, setEditName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [newPubDoi, setNewPubDoi] = useState('');
  const [addingPublication, setAddingPublication] = useState(false);
  const [addPubError, setAddPubError] = useState(null);
  const [graphIndex, setGraphIndex] = useState(0);
  const [savingCover, setSavingCover] = useState(false);
  const [newAdditionalLink, setNewAdditionalLink] = useState('');
  const [savingAdditionalLinks, setSavingAdditionalLinks] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedCartColonies, setSelectedCartColonies] = useState(new Set());
  const [cartGroupName, setCartGroupName] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState(null);

  const backendUrl = '';

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`${backendUrl}/api/public/projects/${projectId}/`, { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('You must be logged in to view project details.');
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProject(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
      setError(null);
    } catch (err) {
      console.error('Error fetching project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (authLoading) return;
    if (!authData.authenticated) {
      setError('You must be logged in to view project details.');
      setLoading(false);
      return;
    }
    setError(null);
    if (projectId) fetchProject();
  }, [projectId, authData.authenticated, authLoading, fetchProject]);

  useEffect(() => {
    if (!project) return;

    const colonyIds = Array.isArray(project.colonies)
      ? project.colonies.map((colony) => colony.id)
      : [];
    setSelectedCartColonies(new Set(colonyIds));
    setCartGroupName(project.name ? `${project.name} colonies` : 'Project colonies');
  }, [project]);

  const isOwner = project && project.owner && authData.username && project.owner.username === authData.username;

  const patchProject = async (payload) => {
    const csrf = getCsrfToken();
    const res = await fetch(`${backendUrl}/api/auth/projects/${projectId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  };

  const addPublication = async () => {
    const doi = newPubDoi.trim();
    if (!doi) return;
    setAddPubError(null);
    setAddingPublication(true);
    try {
      const citation = await fetchCitationByDoi(doi);
      if (!citation || citation.title == null || citation.year == null) {
        setAddPubError('Could not fetch publication data for this DOI. Check the DOI or try again.');
        setAddingPublication(false);
        return;
      }
      const csrf = getCsrfToken();
      const res = await fetch(`${backendUrl}/api/auth/projects/${projectId}/publications/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf || '' },
        body: JSON.stringify({
          title: citation.title,
          year: citation.year,
          doi: normalizeDoi(doi) || doi,
          authors: citation.authors || '',
          journal: citation.journal || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      setNewPubDoi('');
      await fetchProject();
    } catch (err) {
      setAddPubError(err.message || 'Failed to add publication');
    } finally {
      setAddingPublication(false);
    }
  };

  const removePublication = async (publicationId) => {
    if (!window.confirm('Remove this publication from the project?')) return;
    const csrf = getCsrfToken();
    const res = await fetch(`${backendUrl}/api/auth/projects/${projectId}/publications/${publicationId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf || '' },
    });
    if (!res.ok) throw new Error('Failed to remove publication');
    await fetchProject();
  };

  const patchCoverPhoto = async (file, clear) => {
    setSavingCover(true);
    try {
      const formData = new FormData();
      if (file) formData.append('cover_photo', file);
      if (clear) formData.append('clear_cover_photo', 'true');
      const csrf = getCsrfToken();
      const res = await fetch(`${backendUrl}/api/auth/projects/${projectId}/attachment/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrf || '' },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      setSaveMessage('Cover photo updated');
      setTimeout(() => setSaveMessage(null), 3000);
      await fetchProject();
    } catch (err) {
      setSaveMessage(err.message || 'Failed to update cover photo');
    } finally {
      setSavingCover(false);
    }
  };

  const patchAdditionalLinks = async (linksArray) => {
    const csrf = getCsrfToken();
    const res = await fetch(`${backendUrl}/api/auth/projects/${projectId}/attachment/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf || '' },
      body: JSON.stringify({ additional_links: linksArray }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    await fetchProject();
  };

  const addAdditionalLink = async () => {
    const url = newAdditionalLink.trim();
    if (!url) return;
    const list = Array.isArray(project?.attachment?.additional_links) ? [...project.attachment.additional_links] : [];
    const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    if (list.includes(normalized)) return;
    setSavingAdditionalLinks(true);
    try {
      await patchAdditionalLinks([...list, normalized]);
      setNewAdditionalLink('');
      setSaveMessage('Link added');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err.message || 'Failed to add link');
    } finally {
      setSavingAdditionalLinks(false);
    }
  };

  const removeAdditionalLink = async (index) => {
    const list = Array.isArray(project?.attachment?.additional_links) ? [...project.attachment.additional_links] : [];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    setSavingAdditionalLinks(true);
    try {
      await patchAdditionalLinks(list);
      setSaveMessage('Link removed');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err.message || 'Failed to remove link');
    } finally {
      setSavingAdditionalLinks(false);
    }
  };

  const handleSaveName = async () => {
    if (editName.trim() === '') return;
    try {
      await patchProject({ name: editName.trim() });
      setProject((p) => ({ ...p, name: editName.trim() }));
      setEditingName(false);
      setSaveMessage('Name saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err.message);
    }
  };

  const handleSaveDescription = async () => {
    try {
      await patchProject({ description: editDescription });
      setProject((p) => ({ ...p, description: editDescription }));
      setEditingDescription(false);
      setSaveMessage('Description saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatThermalData = (data, type) => {
    if (!data || data.length === 0) return 'No data available';
    
    // Group by condition and timepoint to avoid duplicates
    const grouped = {};
    data.forEach((item) => {
      const key = `${item.condition} (Timepoint: ${item.timepoint})`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      if (item[type] != null) {
        grouped[key].push(item[type]);
      }
    });
    
    // Format each group
    return Object.entries(grouped)
      .map(([key, values]) => {
        if (values.length === 0) return `${key}: N/A`;
        if (values.length === 1) return `${key}: ${values[0]}`;
        // Multiple values: show all unique values
        const uniqueValues = [...new Set(values)];
        return `${key}: ${uniqueValues.join(', ')}`;
      })
      .join('; ');
  };

  const getColonyConditionsAndTimepoints = (colony) => {
    const conditions = new Set();
    const timepoints = new Set();
    for (const arr of [colony?.breakpoint_temperatures, colony?.thermal_tolerances, colony?.thermal_limits]) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item?.condition != null && item.condition !== '') conditions.add(String(item.condition));
        if (item?.timepoint != null && item.timepoint !== '') timepoints.add(String(item.timepoint));
      }
    }
    return {
      conditions: [...conditions].sort(),
      timepoints: [...timepoints].sort(),
    };
  };

  const openCartModal = () => {
    const colonyIds = Array.isArray(project?.colonies)
      ? project.colonies.map((colony) => colony.id)
      : [];
    setSelectedCartColonies(new Set(colonyIds));
    setCartGroupName(project?.name ? `${project.name} colonies` : 'Project colonies');
    setCartMessage(null);
    setShowCartModal(true);
  };

  const toggleCartColony = (colonyId) => {
    setSelectedCartColonies((previous) => {
      const next = new Set(previous);
      if (next.has(colonyId)) {
        next.delete(colonyId);
      } else {
        next.add(colonyId);
      }
      return next;
    });
  };

  const setAllCartColonies = (checked) => {
    const colonyIds = checked && Array.isArray(project?.colonies)
      ? project.colonies.map((colony) => colony.id)
      : [];
    setSelectedCartColonies(new Set(colonyIds));
  };

  const handleProjectAddToCart = async () => {
    const colonyIds = Array.from(selectedCartColonies);
    if (!cartGroupName.trim()) {
      setCartMessage({ type: 'danger', text: 'Please enter a cart group name.' });
      return;
    }
    if (colonyIds.length === 0) {
      setCartMessage({ type: 'danger', text: 'Select at least one colony.' });
      return;
    }

    setAddingToCart(true);
    setCartMessage(null);
    try {
      await addToCart(
        colonyIds,
        { project: project?.name || '', source: 'project_detail', project_id: project?.id },
        cartGroupName.trim(),
        backendUrl
      );
      setCartMessage({ type: 'success', text: `${colonyIds.length} colonies added to cart.` });
      setTimeout(() => {
        setShowCartModal(false);
        setCartMessage(null);
      }, 900);
    } catch (err) {
      console.error('Error adding project colonies to cart:', err);
      setCartMessage({ type: 'danger', text: 'Could not add selected colonies to cart.' });
    } finally {
      setAddingToCart(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="project-detail-page">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">{authLoading ? 'Checking authentication...' : 'Loading project details...'}</p>
          </div>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-detail-page">
        <Container className="py-5">
          <div className="text-center">
            <h4 className="text-danger">Error Loading Project</h4>
            <p className="text-muted">{error}</p>
            <Button variant="outline-primary" onClick={() => navigate('/projects')}>
              <ArrowLeft className="me-2" size={16} />
              Back to Projects
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail-page">
        <Container className="py-5">
          <div className="text-center">
            <h4>Project Not Found</h4>
            <p className="text-muted">The requested project could not be found.</p>
            <Button variant="outline-primary" onClick={() => navigate('/projects')}>
              <ArrowLeft className="me-2" size={16} />
              Back to Projects
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  const att = project.attachment;

  const graphSlides = att ? [
    att.boxplot && { label: 'Boxplot', url: att.boxplot },
    att.temp_curve && { label: 'Temp curve', url: att.temp_curve },
    att.model_curve && { label: 'Model curve', url: att.model_curve },
  ].filter(Boolean) : [];
  const slideIndex = graphSlides.length ? Math.min(graphIndex, graphSlides.length - 1) : 0;
  const currentSlide = graphSlides[slideIndex];
  const hasMultipleGraphs = graphSlides.length > 1;

  const statisticsRows = att?.statistics != null
    ? (Array.isArray(att.statistics) ? att.statistics : [att.statistics])
    : [];
  const statisticsKeys = statisticsRows.length > 0 && typeof statisticsRows[0] === 'object' && statisticsRows[0] !== null
    ? [...new Set(statisticsRows.flatMap((row) => Object.keys(row)))].sort((a, b) => {
        const aOrder = STATISTICS_COLUMN_ORDER.indexOf(normalizeStatisticsKey(a));
        const bOrder = STATISTICS_COLUMN_ORDER.indexOf(normalizeStatisticsKey(b));
        if (aOrder !== -1 || bOrder !== -1) {
          if (aOrder === -1) return 1;
          if (bOrder === -1) return -1;
          return aOrder - bOrder;
        }
        return a.localeCompare(b);
      })
    : [];
  const projectColonies = Array.isArray(project.colonies) ? project.colonies : [];
  const allCartColoniesSelected = projectColonies.length > 0 && selectedCartColonies.size === projectColonies.length;

  return (
    <div className="project-detail-page">
      <div
        className={`project-header${att?.cover_photo ? ' project-header-has-cover' : ''}`}
        style={att?.cover_photo ? { backgroundImage: `url(${att.cover_photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <Container>
          <div className="text-center mb-4">
            <Button variant="outline-light" onClick={() => navigate('/projects')} className="mb-4">
              <ArrowLeft className="me-2" size={16} />
              Back to Projects
            </Button>
            {isOwner && editingName ? (
              <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                <Form.Control
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="project-title-input"
                  style={{ maxWidth: 400 }}
                />
                <Button variant="light" size="sm" onClick={handleSaveName}>Save</Button>
                <Button variant="outline-light" size="sm" onClick={() => { setEditName(project.name); setEditingName(false); }}>Cancel</Button>
              </div>
            ) : (
              <h1 className="project-title">
                {project.name}
                {isOwner && (
                  <Button variant="link" className="text-white p-0 ms-2" onClick={() => setEditingName(true)} title="Edit name">
                    <PencilSquare size={20} />
                  </Button>
                )}
              </h1>
            )}
            <div className="project-meta">
              <span className="meta-item">
                <Calendar className="me-2" size={16} />
                Created: {formatDate(project.registration_date)}
              </span>
              <span className="meta-item">
                <Person className="me-2" size={16} />
                Owner: {project.owner?.username || 'Unknown'}
              </span>
            </div>
            {project.colonies && project.colonies.length > 0 && (
              <Button variant="light" className="project-cart-button" onClick={openCartModal}>
                <i className="bi bi-cart4 me-2"></i>
                Add colonies to cart
              </Button>
            )}
            {saveMessage && <p className="text-white mb-0 mt-2 small">{saveMessage}</p>}
          </div>
        </Container>
      </div>

      <Container className="py-5">
        {/* Description */}
        <Row className="mb-5">
          <Col>
            <Card className="section-card">
              <Card.Header className="section-header">
                <FileText className="me-2" size={20} />
                Description
              </Card.Header>
              <Card.Body>
                {isOwner && editingDescription ? (
                  <>
                    <Form.Control as="textarea" rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    <div className="mt-2">
                      <Button variant="primary" size="sm" onClick={handleSaveDescription}>Save</Button>
                      <Button variant="outline-secondary" size="sm" className="ms-2" onClick={() => { setEditDescription(project.description || ''); setEditingDescription(false); }}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="project-description mb-0">{project.description || 'No description.'}</p>
                    {isOwner && (
                      <Button variant="outline-primary" size="sm" className="mt-2" onClick={() => setEditingDescription(true)}>
                        <PencilSquare className="me-1" size={14} />
                        Edit description
                      </Button>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Cover photo (owner only) */}
        {isOwner && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <Image className="me-2" size={20} />
                  Cover photo
                </Card.Header>
                <Card.Body>
                  <p className="text-muted small mb-2">Used as the project header background image.</p>
                  {att?.cover_photo ? (
                    <div className="mb-3">
                      <img src={att.cover_photo} alt="Cover" className="cover-photo-preview rounded" />
                    </div>
                  ) : (
                    <p className="text-muted small mb-3">No cover photo. Default header image is shown.</p>
                  )}
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <Form.Control
                      type="file"
                      accept="image/*"
                      className="d-inline-block"
                      style={{ maxWidth: 280 }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) patchCoverPhoto(file, false);
                        e.target.value = '';
                      }}
                      disabled={savingCover}
                    />
                    {att?.cover_photo && (
                      <Button variant="outline-danger" size="sm" onClick={() => patchCoverPhoto(null, true)} disabled={savingCover}>
                        Clear cover photo
                      </Button>
                    )}
                    {savingCover && <span className="text-muted small">Saving…</span>}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Publications */}
        <Row className="mb-5">
          <Col>
            <Card className="section-card publications-card">
              <Card.Header className="section-header">
                <JournalText className="me-2" size={20} />
                Publications
              </Card.Header>
              <Card.Body className="publications-card-body">
                {project.publications && project.publications.length > 0 && (
                  <div className="publications-list mb-4">
                    {project.publications.map((pub) => (
                      <div key={pub.id} className="publication-item d-flex justify-content-between align-items-start flex-wrap gap-2">
                        <div className="publication-full">
                          {pub.authors && <div className="publication-authors text-muted small">{pub.authors}</div>}
                          <h6 className="publication-title">{pub.title}</h6>
                          {pub.journal && <div className="publication-journal text-muted small">{pub.journal}</div>}
                          <div className="publication-meta">
                            <Badge bg="light" text="dark" className="me-2">{pub.year}</Badge>
                            {pub.doi && pub.doi !== 'No doi available' && (
                              <a href={getDoiUrl(pub.doi)} target="_blank" rel="noopener noreferrer" className="publication-link">
                                <BoxArrowUpRight size={12} className="me-1" />
                                View DOI
                              </a>
                            )}
                          </div>
                        </div>
                        {isOwner && (
                          <Button variant="outline-danger" size="sm" onClick={() => removePublication(pub.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {isOwner && (
                  <div className="add-publication border rounded p-3 bg-light">
                    <h6 className="mb-2">Add publication</h6>
                    <p className="text-muted small mb-2">Enter a DOI; title and year will be fetched from the citation service.</p>
                    <Form.Group className="mb-2">
                      <Form.Control
                        placeholder="DOI (e.g. 10.1145/2783446.2783605)"
                        value={newPubDoi}
                        onChange={(e) => { setNewPubDoi(e.target.value); setAddPubError(null); }}
                        disabled={addingPublication}
                      />
                    </Form.Group>
                    {addPubError && <p className="text-danger small mb-2">{addPubError}</p>}
                    <Button variant="primary" size="sm" onClick={addPublication} disabled={!newPubDoi.trim() || addingPublication}>
                      {addingPublication ? 'Fetching…' : 'Add publication'}
                    </Button>
                  </div>
                )}
                {(!project.publications || project.publications.length === 0) && !isOwner && (
                  <div className="text-muted small">No publications available</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Additional links */}
        <Row className="mb-5">
          <Col>
            <Card className="section-card">
              <Card.Header className="section-header">
                <Link45deg className="me-2" size={20} />
                Additional links
              </Card.Header>
              <Card.Body>
                {att?.additional_links && att.additional_links.length > 0 ? (
                  <ul className="list-unstyled mb-0">
                    {att.additional_links.map((url, index) => (
                      <li key={index} className="d-flex align-items-center gap-2 mb-2">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-break">
                          <BoxArrowUpRight size={12} className="me-1 align-middle" />
                          {url.length > 60 ? `${url.slice(0, 60)}…` : url}
                        </a>
                        {isOwner && (
                          <Button variant="outline-danger" size="sm" onClick={() => removeAdditionalLink(index)} disabled={savingAdditionalLinks}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !isOwner && <div className="text-muted small">No additional links.</div>
                )}
                {isOwner && (
                  <div className="mt-3 pt-3 border-top">
                    <Form.Group className="mb-2">
                      <Form.Control
                        type="url"
                        placeholder="https://example.com"
                        value={newAdditionalLink}
                        onChange={(e) => setNewAdditionalLink(e.target.value)}
                        disabled={savingAdditionalLinks}
                      />
                    </Form.Group>
                    <Button variant="primary" size="sm" onClick={addAdditionalLink} disabled={!newAdditionalLink.trim() || savingAdditionalLinks}>
                      {savingAdditionalLinks ? 'Saving…' : 'Add link'}
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Graphs (carousel) */}
        <Row className="mb-5">
          <Col>
            <Card className="section-card">
              <Card.Header className="section-header">
                <Image className="me-2" size={20} />
                Graphs
              </Card.Header>
              <Card.Body className="graphs-card-body">
                {graphSlides.length > 0 ? (
                  <>
                    <div className="graph-carousel">
                      <div className="graph-carousel-image-wrap">
                        <img src={currentSlide?.url} alt={currentSlide?.label || 'Graph'} className="graph-carousel-image" />
                      </div>
                      <div className="graph-carousel-caption">{currentSlide?.label || ''}</div>
                      {hasMultipleGraphs && (
                        <div className="graph-carousel-nav">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setGraphIndex((i) => (i - 1 + graphSlides.length) % graphSlides.length)}
                          >
                            ← Back
                          </Button>
                          <span className="graph-carousel-dots">
                            {graphSlides.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`graph-dot ${i === slideIndex ? 'active' : ''}`}
                                onClick={() => setGraphIndex(i)}
                                aria-label={`Slide ${i + 1}`}
                              />
                            ))}
                          </span>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setGraphIndex((i) => (i + 1) % graphSlides.length)}
                          >
                            Next →
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-muted text-center py-4">No graphs for this project.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Statistics (table) */}
        <Row className="mb-5">
          <Col>
            <Card className="section-card statistics-card">
              <Card.Header className="section-header">
                <FileText className="me-2" size={20} />
                Statistics
              </Card.Header>
              <Card.Body className="statistics-card-body">
                {statisticsRows.length > 0 && statisticsKeys.length > 0 ? (
                  <div className="statistics-table-wrap">
                    <Table striped hover className="statistics-table">
                      <thead>
                        <tr>
                          {statisticsKeys.map((key) => (
                            <th key={key}>{key.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {statisticsRows.map((row, idx) => (
                          <tr key={idx}>
                            {statisticsKeys.map((key) => (
                              <td key={key}>{formatStatisticsValue(row[key], key)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted text-center py-3">No statistics for this project.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Experiments */}
        {project.experiments && project.experiments.length > 0 && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <FileText className="me-2" size={20} />
                  Experiments ({project.experiments.length})
                </Card.Header>
                <Card.Body>
                  <Table responsive striped hover>
                    <thead>
                      <tr>
                        <th>Experiment Name</th>
                        <th>Species</th>
                        <th>Experiment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.experiments.map((experiment) => (
                        <tr key={experiment.id}>
                          <td>{experiment.name}</td>
                          <td>{experiment.species || '—'}</td>
                          <td>{formatDate(experiment.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Colonies */}
        {project.colonies && project.colonies.length > 0 && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <Globe className="me-2" size={20} />
                  Colonies ({project.colonies.length})
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <Table responsive striped hover>
                      <thead>
                        <tr>
                          <th>Colony Name</th>
                          <th>Species</th>
                          <th>Country</th>
                          <th>Coordinates</th>
                          <th>Condition</th>
                          <th>Timepoint</th>
                          <th>Breakpoint Temperature ED5</th>
                          <th>Thermal Tolerance ED50</th>
                          <th>Thermal Limit ED95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.colonies.map((colony) => {
                          const { conditions, timepoints } = getColonyConditionsAndTimepoints(colony);
                          return (
                            <tr key={colony.id}>
                              <td>{colony.name}</td>
                              <td>{colony.species}</td>
                              <td>{colony.country}</td>
                              <td><small className="text-muted">{colony.latitude}, {colony.longitude}</small></td>
                              <td><small>{conditions.length ? conditions.join(', ') : '—'}</small></td>
                              <td><small>{timepoints.length ? timepoints.join(', ') : '—'}</small></td>
                              <td><small>{formatThermalData(colony.breakpoint_temperatures, 'abs_breakpoint_temperature')}</small></td>
                              <td><small>{formatThermalData(colony.thermal_tolerances, 'abs_thermal_tolerance')}</small></td>
                              <td><small>{formatThermalData(colony.thermal_limits, 'abs_thermal_limit')}</small></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Observations */}
        {project.observations && project.observations.length > 0 && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <ThermometerHalf className="me-2" size={20} />
                  Observations ({project.observations.length})
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <Table responsive striped hover>
                      <thead>
                        <tr>
                          <th>Exp. Measurement</th>
                          <th>Collection Date</th>
                          <th>Experiment</th>
                          <th>Condition</th>
                          <th>Temperature</th>
                          <th>Timepoint</th>
                          <th>PAM Value</th>
                          <th>Related Projects</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.observations.map((observation) => (
                          <tr key={observation.id}>
                            <td>{observation.biosample?.name}</td>
                            <td>{observation.biosample?.collection_date ? formatDate(observation.biosample.collection_date) : 'N/A'}</td>
                            <td>{observation.experiment?.name}</td>
                            <td>{observation.condition}</td>
                            <td>{observation.temperature}°C</td>
                            <td>{observation.timepoint}</td>
                            <td>{observation.pam_value ?? 'N/A'}</td>
                            <td>
                              {observation.related_projects?.length > 0 ? (
                                <ul className="list-unstyled mb-0">
                                  {observation.related_projects.map((proj, idx) => (
                                    <li key={idx} className="small">{proj.name}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted small">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {(!project.experiments || project.experiments.length === 0) &&
         (!project.colonies || project.colonies.length === 0) &&
         (!project.observations || project.observations.length === 0) && (
          <Row>
            <Col>
              <Card className="text-center py-5 section-card">
                <Card.Body>
                  <FileText size={64} className="text-muted mb-3" />
                  <h5 className="text-muted">No Data Available</h5>
                  <p className="text-muted">This project doesn't have any experiments, colonies, or observations yet.</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>

      <Modal show={showCartModal} onHide={() => setShowCartModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Project Colonies to Cart</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cartMessage && (
            <Alert variant={cartMessage.type} className="mb-3">
              {cartMessage.text}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Cart Group Name</Form.Label>
            <Form.Control
              type="text"
              value={cartGroupName}
              onChange={(event) => setCartGroupName(event.target.value)}
              placeholder="Enter a name for this cart group"
            />
          </Form.Group>

          <div className="cart-colony-toolbar">
            <Form.Check
              type="checkbox"
              id="select-all-project-colonies"
              label={`Select all colonies (${projectColonies.length})`}
              checked={allCartColoniesSelected}
              onChange={(event) => setAllCartColonies(event.target.checked)}
            />
            <span className="text-muted small">
              Selected: {selectedCartColonies.size}
            </span>
          </div>

          <div className="cart-colony-list">
            {projectColonies.map((colony) => (
              <label key={colony.id} className="cart-colony-option">
                <Form.Check
                  type="checkbox"
                  checked={selectedCartColonies.has(colony.id)}
                  onChange={() => toggleCartColony(colony.id)}
                  aria-label={`Select ${colony.name}`}
                />
                <div className="cart-colony-option-main">
                  <div className="cart-colony-name">{colony.name}</div>
                  <div className="cart-colony-meta">
                    {colony.species || 'Unknown species'} · {colony.country || 'Unknown location'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCartModal(false)} disabled={addingToCart}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleProjectAddToCart} disabled={addingToCart || selectedCartColonies.size === 0}>
            {addingToCart ? 'Adding...' : `Add ${selectedCartColonies.size} to Cart`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectDetailPage;
