import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Badge, Table, Button, Spinner, Form } from 'react-bootstrap';
import { 
  ArrowLeft, 
  Calendar, 
  Person, 
  JournalText, 
  Globe,
  FileText,
  BoxArrowUpRight,
  ThermometerHalf,
  MapPin,
  GraphUp,
  Pencil,
  Check,
  X
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ProjectDetailPage.css';
import { AuthContext } from '../../contexts/AuthContext';
import Cookies from 'js-cookie';

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { authData } = useContext(AuthContext);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingDescription, setEditingDescription] = useState(null); // attachment id being edited
  const [descriptionValue, setDescriptionValue] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Check if current user is the project owner
  const isProjectOwner = React.useMemo(() => {
    if (!project || !authData?.user) return false;
    
    const currentUsername = authData.user.username;
    const ownerUsername = project.owner?.username;
    
    console.log('Auth check:', {
      currentUser: currentUsername,
      projectOwner: ownerUsername,
      isOwner: currentUsername === ownerUsername
    });
    
    return currentUsername === ownerUsername;
  }, [project, authData]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const backendUrl = '';
        const response = await fetch(`${backendUrl}/api/public/projects/${projectId}/`, {
          credentials: 'include'
        });
        
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

  const handleEditDescription = (attachment) => {
    setEditingDescription(attachment.id);
    setDescriptionValue(attachment.description || '');
  };

  const handleCancelEdit = () => {
    setEditingDescription(null);
    setDescriptionValue('');
  };

  const handleSaveDescription = async (attachmentId) => {
    setSavingDescription(true);
    try {
      const backendUrl = '';
      const csrfToken = Cookies.get('csrftoken');
      
      const response = await fetch(`${backendUrl}/api/auth/ed50-attachments/${attachmentId}/description/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ description: descriptionValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update description');
      }

      const result = await response.json();
      
      // Update the project state with new description
      setProject(prevProject => ({
        ...prevProject,
        ed50_attachments: prevProject.ed50_attachments.map(att =>
          att.id === attachmentId ? { ...att, description: descriptionValue } : att
        ),
      }));

      setEditingDescription(null);
      setDescriptionValue('');
    } catch (error) {
      console.error('Error updating description:', error);
      alert('Failed to update description');
    } finally {
      setSavingDescription(false);
    }
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
        </Container>
      </div>

      <Container className="py-5">
        {/* Publications - First */}
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

        {/* Attachments Section */}
        {project.ed50_attachments && project.ed50_attachments.length > 0 && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <GraphUp className="me-2" size={20} />
                  Attachments
                </Card.Header>
                <Card.Body>
                  {project.ed50_attachments.map((attachment) => (
                    <div key={attachment.id}>
                      {/* Description Section */}
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Description</h6>
                          {isProjectOwner && editingDescription !== attachment.id && (
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              onClick={() => handleEditDescription(attachment)}
                            >
                              <Pencil size={14} className="me-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                        
                        {editingDescription === attachment.id ? (
                          <div>
                            <ReactQuill 
                              theme="snow"
                              value={descriptionValue}
                              onChange={setDescriptionValue}
                              style={{ marginBottom: '10px' }}
                            />
                            <div className="mt-2">
                              <Button 
                                variant="success" 
                                size="sm" 
                                className="me-2"
                                onClick={() => handleSaveDescription(attachment.id)}
                                disabled={savingDescription}
                              >
                                <Check size={16} className="me-1" />
                                {savingDescription ? 'Saving...' : 'Save'}
                              </Button>
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={savingDescription}
                              >
                                <X size={16} className="me-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="border rounded p-3 bg-light"
                            dangerouslySetInnerHTML={{ 
                              __html: attachment.description || '<em>No description provided</em>' 
                            }}
                          />
                        )}
                      </div>

                      {/* Plots - 1 graph per row, larger */}
                      {attachment.boxplot_image_url && (
                        <div className="mb-4">
                          <div className="text-center mb-2">
                            <h6 className="mb-0">ED50s Boxplot</h6>
                          </div>
                          <img 
                            src={attachment.boxplot_image_url} 
                            alt="ED50s Boxplot"
                            className="img-fluid border rounded"
                            style={{ cursor: 'pointer', width: '100%' }}
                            onClick={() => window.open(attachment.boxplot_image_url, '_blank')}
                          />
                        </div>
                      )}
                      {attachment.temperature_curve_image_url && (
                        <div className="mb-4">
                          <div className="text-center mb-2">
                            <h6 className="mb-0">Temperature Response Curves</h6>
                          </div>
                          <img 
                            src={attachment.temperature_curve_image_url} 
                            alt="Temperature Response Curves"
                            className="img-fluid border rounded"
                            style={{ cursor: 'pointer', width: '100%' }}
                            onClick={() => window.open(attachment.temperature_curve_image_url, '_blank')}
                          />
                        </div>
                      )}
                      {attachment.model_curve_image_url && (
                        <div className="mb-4">
                          <div className="text-center mb-2">
                            <h6 className="mb-0">Model Curve with ED bands</h6>
                          </div>
                          <img 
                            src={attachment.model_curve_image_url} 
                            alt="Model Curve with ED bands"
                            className="img-fluid border rounded"
                            style={{ cursor: 'pointer', width: '100%' }}
                            onClick={() => window.open(attachment.model_curve_image_url, '_blank')}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Aggregated Statistics Section */}
        {project.ed50_attachments && project.ed50_attachments.length > 0 && 
         project.ed50_attachments.some(att => att.aggregated_statistics && att.aggregated_statistics.length > 0) && (
          <Row className="mb-5">
            <Col>
              <Card className="section-card">
                <Card.Header className="section-header">
                  <GraphUp className="me-2" size={20} />
                  Aggregated Statistics
                </Card.Header>
                <Card.Body>
                  {project.ed50_attachments.map((attachment) => (
                    attachment.aggregated_statistics && 
                    attachment.aggregated_statistics.length > 0 && (
                      <div 
                        key={attachment.id} 
                        style={{ 
                          maxHeight: '500px', 
                          overflowY: 'auto', 
                          overflowX: 'auto',
                          display: 'block'
                        }}
                      >
                        <Table striped hover style={{ minWidth: '100%', width: 'max-content' }}>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                            <tr>
                              {Object.keys(attachment.aggregated_statistics[0]).map((key) => (
                                <th key={key} className="text-nowrap">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {attachment.aggregated_statistics.map((row, idx) => (
                              <tr key={idx}>
                                {Object.values(row).map((value, vidx) => (
                                  <td key={vidx} className="text-nowrap">{value !== null && value !== undefined ? value : 'N/A'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )
                  ))}
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
