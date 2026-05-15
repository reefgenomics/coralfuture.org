import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Container, Row, Col, Card, Badge, Button, Form } from 'react-bootstrap';
import { 
  JournalText, 
  Calendar, 
  Person, 
  FileText,
  Globe,
  Eye,
} from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ProjectsPage.css';
import { AuthContext } from '../../contexts/AuthContext';
import { formatViewCount } from '../../utils/formatViewCount';

const DEFAULT_SORT = 'date-desc';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { authData } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);

  const sortedProjects = useMemo(() => {
    const list = Array.isArray(projects) ? [...projects] : [];
    const dateDescTie = (a, b) => {
      const ta = new Date(a.registration_date || 0).getTime();
      const tb = new Date(b.registration_date || 0).getTime();
      return tb - ta;
    };
    const cmpDate = (a, b) => {
      const ta = new Date(a.registration_date || 0).getTime();
      const tb = new Date(b.registration_date || 0).getTime();
      return ta - tb;
    };
    const cmpViews = (a, b) => {
      const va = Number(a.view_count) || 0;
      const vb = Number(b.view_count) || 0;
      return va - vb;
    };
    switch (sortKey) {
      case 'date-asc':
        list.sort((a, b) => cmpDate(a, b) || a.id - b.id);
        break;
      case 'date-desc':
        list.sort((a, b) => cmpDate(b, a) || b.id - a.id);
        break;
      case 'views-asc':
        list.sort((a, b) => cmpViews(a, b) || dateDescTie(a, b) || a.id - b.id);
        break;
      case 'views-desc':
        list.sort((a, b) => cmpViews(b, a) || dateDescTie(a, b) || b.id - a.id);
        break;
      default:
        break;
    }
    return list;
  }, [projects, sortKey]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const backendUrl = '';
        const response = await fetch(`${backendUrl}/api/public/projects/`);
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDoiUrl = (doi) => {
    if (!doi) return null;
    const s = String(doi).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return `https://doi.org/${s.replace(/^https?:\/\/doi\.org\/?/i, '')}`;
  };

  const getProjectCoverPhoto = (project) => {
    return project?.attachment?.cover_photo
      || project?.cover_photo
      || project?.cover_photo_url
      || project?.image
      || null;
  };

  const getOwnerName = (owner) => (
    [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || owner?.username || 'Unknown'
  );

  const renderOwnerAvatar = (owner) => (
    owner?.profile_photo_url ? (
      <img src={owner.profile_photo_url} alt="" className="owner-avatar" />
    ) : (
      <span className="owner-avatar owner-avatar-placeholder">
        {(getOwnerName(owner) || '?').charAt(0).toUpperCase()}
      </span>
    )
  );

  if (loading) {
    return (
      <div className="projects-page">
        <Container className="py-5">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading projects...</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="projects-page">
      {/* Projects Grid */}
      <Container className="py-5">
        <div className="text-center mb-5">
          <h1 className="page-title">Coral Research Projects</h1>
          <p className="page-subtitle">
            Explore our collection of coral research projects from around the world. 
            Each project contributes to our understanding of coral reef ecosystems and thermal tolerance.
          </p>
          <div className="projects-sort-bar">
            <Form.Label htmlFor="projects-sort" className="projects-sort-label">
              Sort by
            </Form.Label>
            <Form.Select
              id="projects-sort"
              size="sm"
              className="projects-sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              aria-label="Sort projects list"
            >
              <option value="date-desc">Registration date — newest first</option>
              <option value="date-asc">Registration date — oldest first</option>
              <option value="views-desc">Views — highest first</option>
              <option value="views-asc">Views — lowest first</option>
            </Form.Select>
          </div>
        </div>
        <Row className="g-4">
          {sortedProjects.map((project) => {
            const coverPhoto = getProjectCoverPhoto(project);
            return (
            <Col key={project.id} lg={6} xl={4}>
              <Card
                className={`project-card h-100${coverPhoto ? ' project-card-with-cover' : ''}`}
                style={coverPhoto ? { '--project-cover-image': `url(${coverPhoto})` } : undefined}
              >
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div className="project-icon">
                      <JournalText size={24} className="text-primary" />
                    </div>
                    <div className="project-badges d-flex flex-wrap gap-2 justify-content-end align-items-center">
                      <Badge bg="light" text="primary" className="project-badge">
                        {project.publications?.length || 0} Publications
                      </Badge>
                      <Badge
                        bg="light"
                        text="secondary"
                        className="project-badge project-views-badge"
                        title="Times signed-in users opened the project detail page"
                      >
                        <Eye size={14} className="me-1" aria-hidden />
                        <span>{formatViewCount(project.view_count)}</span>
                        <span className="ms-1 d-none d-sm-inline text-muted fw-normal small">views</span>
                      </Badge>
                    </div>
                  </div>
                  
                  <h5 className="project-title mb-3">
                    {project.name}
                  </h5>
      
                  
                  <div className="project-meta mb-4">
                    <div className="meta-item">
                      <Calendar size={16} className="text-muted me-2" />
                      <span className="text-muted">Created: {formatDate(project.registration_date)}</span>
                    </div>
                    <div className="meta-item owner-meta">
                      <Person size={16} className="text-muted owner-meta-icon" />
                      <div className="owner-meta-content">
                        <span className="owner-meta-label">Owner:</span>
                        {project.owner?.username ? (
                          <Link to={`/users/${project.owner.username}`} className="owner-inline owner-profile-link">
                            {renderOwnerAvatar(project.owner)}
                            <span>{getOwnerName(project.owner)}</span>
                          </Link>
                        ) : <span className="text-muted">Unknown</span>}
                        {project.owner?.affiliation && (
                          <span className="owner-affiliation">{project.owner.affiliation}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {project.publications && project.publications.length > 0 ? (
                    <div className="publications-section mb-4">
                      <h6 className="publications-title">
                        <FileText size={16} className="me-2" />
                        Publications
                      </h6>
                      <div className="publications-list">
                        {project.publications.slice(0, 2).map((pub, index) => (
                          <div key={pub.id || index} className="publication-item">
                            {pub.authors && <div className="text-muted small">{pub.authors}</div>}
                            <div className="publication-title">{pub.title}</div>
                            {pub.journal && <div className="text-muted small">{pub.journal}</div>}
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              {pub.year && <Badge bg="light" text="dark" className="small">{pub.year}</Badge>}
                              {pub.doi && pub.doi !== 'No doi available' && (
                                <a 
                                  href={getDoiUrl(pub.doi)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="publication-link"
                                >
                                  View DOI
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                        {project.publications.length > 2 && (
                          <div className="text-muted small">
                            +{project.publications.length - 2} more publications
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="publications-section mb-4">
                      <h6 className="publications-title">
                        <FileText size={16} className="me-2" />
                        Publications
                      </h6>
                      <div className="publications-list">
                        <div className="text-muted small">No publications available</div>
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    variant="outline-primary" 
                    className="w-100 project-button mt-auto"
                    onClick={() => {
                      if (authData.authenticated) {
                        navigate(`/project/${project.id}`);
                      } else {
                        navigate('/login');
                      }
                    }}
                  >
                    <Globe className="me-2" size={16} />
                    View Project Details
                  </Button>
                </Card.Body>
              </Card>
            </Col>
            );
          })}
        </Row>
        
        {projects.length === 0 && (
          <div className="text-center py-5">
            <JournalText size={64} className="text-muted mb-3" />
            <h4 className="text-muted">No Projects Available</h4>
            <p className="text-muted">Check back later for new research projects.</p>
          </div>
        )}
      </Container>
    </div>
  );
};

export default ProjectsPage;
