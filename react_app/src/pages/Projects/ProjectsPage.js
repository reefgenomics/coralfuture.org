import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Badge, Button } from 'react-bootstrap';
import { 
  JournalText, 
  Calendar, 
  Person, 
  BoxArrowUpRight,
  FileText,
  Globe
} from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ProjectsPage.css';
import { AuthContext } from '../../contexts/AuthContext';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { authData } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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
        </div>
        <Row className="g-4">
          {projects.map((project) => (
            <Col key={project.id} lg={6} xl={4}>
              <Card className="project-card h-100">
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div className="project-icon">
                      <JournalText size={24} className="text-primary" />
                    </div>
                    <Badge bg="light" text="primary" className="project-badge">
                      {project.publications?.length || 0} Publications
                    </Badge>
                  </div>
                  
                  <h5 className="project-title mb-3">
                    {project.name}
                  </h5>
      
                  
                  <div className="project-meta mb-4">
                    <div className="meta-item">
                      <Calendar size={16} className="text-muted me-2" />
                      <span className="text-muted">Created: {formatDate(project.registration_date)}</span>
                    </div>
                    <div className="meta-item">
                      <Person size={16} className="text-muted me-2" />
                      <span className="text-muted">Owner: {project.owner?.username || 'Unknown'}</span>
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
          ))}
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
