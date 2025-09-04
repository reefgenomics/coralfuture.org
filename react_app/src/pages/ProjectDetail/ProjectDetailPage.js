import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Table, Button, Spinner } from 'react-bootstrap';
import { 
  ArrowLeft, 
  Calendar, 
  Person, 
  JournalText, 
  Globe,
  FileText,
  BoxArrowUpRight,
  ThermometerHalf,
  MapPin
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ProjectDetailPage.css';

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/public/projects/${projectId}/`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatThermalData = (data, type) => {
    if (!data || data.length === 0) return 'No data available';
    
    return data.map(item => 
      `${item.condition} (Timepoint: ${item.timepoint}): ${item[type]}`
    ).join(', ');
  };

  if (loading) {
    return (
      <div className="project-detail-page">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Loading project details...</p>
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

  return (
    <div className="project-detail-page">
      {/* Header */}
      <div className="project-header">
        <Container>
          <div className="text-center mb-4">
            <Button 
              variant="outline-light" 
              onClick={() => navigate('/projects')}
              className="mb-4"
            >
              <ArrowLeft className="me-2" size={16} />
              Back to Projects
            </Button>
            <h1 className="project-title">{project.name}</h1>
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
          </div>
          <p className="project-description text-center">{project.description}</p>
        </Container>
      </div>

      <Container className="py-5">
        {/* Publications */}
        {project.publications && project.publications.length > 0 && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <JournalText className="me-2" size={20} />
                  Publications
                </Card.Header>
                <Card.Body>
                  <div className="publications-list">
                    {project.publications.map((pub, index) => (
                      <div key={index} className="publication-item">
                        <h6 className="publication-title">{pub.title}</h6>
                        <div className="publication-meta">
                          <Badge bg="light" text="dark" className="me-2">
                            {pub.year}
                          </Badge>
                          {pub.doi && (
                            <a 
                              href={pub.doi} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="publication-link"
                            >
                              <BoxArrowUpRight size={12} className="me-1" />
                              View DOI
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

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
                        <th>Experiment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.experiments.map((experiment) => (
                        <tr key={experiment.id}>
                          <td>{experiment.name}</td>
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
                          <th>Breakpoint Temperature ED5</th>
                          <th>Thermal Tolerance ED50</th>
                          <th>Thermal Limit ED95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.colonies.map((colony) => (
                          <tr key={colony.id}>
                            <td>{colony.name}</td>
                            <td>{colony.species}</td>
                            <td>{colony.country}</td>
                            <td>
                              <small className="text-muted">
                                {colony.latitude}, {colony.longitude}
                              </small>
                            </td>
                            <td>
                              <small>
                                {formatThermalData(colony.breakpoint_temperatures, 'abs_breakpoint_temperature')}
                              </small>
                            </td>
                            <td>
                              <small>
                                {formatThermalData(colony.thermal_tolerances, 'abs_thermal_tolerance')}
                              </small>
                            </td>
                            <td>
                              <small>
                                {formatThermalData(colony.thermal_limits, 'abs_thermal_limit')}
                              </small>
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
                          <th>BioSample Name</th>
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
                            <td>{observation.pam_value || 'N/A'}</td>
                            <td>
                              {observation.related_projects && observation.related_projects.length > 0 ? (
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

        {/* Empty State */}
        {(!project.experiments || project.experiments.length === 0) && 
         (!project.colonies || project.colonies.length === 0) && 
         (!project.observations || project.observations.length === 0) && (
          <Row>
            <Col>
              <Card className="text-center py-5">
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
    </div>
  );
};

export default ProjectDetailPage;
