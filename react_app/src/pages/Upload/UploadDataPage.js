import React, { useState, useRef, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthContext } from 'contexts/AuthContext';

const backendUrl = '';

const UploadDataPage = () => {
  const { authData } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState({ data: [] });
  const [headers, setHeaders] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef(null);

  // Front-end no longer hard-validates required columns; backend handles mapping/validation.
  const requiredFields = [ // kept only for guideline display
    'Project.name',
    'Experiment.name',
    'Experiment.date',
    'Colony.name',
    'Colony.country',
    'Colony.latitude',
    'Colony.longitude',
    'Colony.species',
    'Colony.ed50',
    'BioSample.name',
    'BioSample.collection_date',
    'Observation.condition',
    'Observation.temperature',
    'Observation.timepoint',
    'Observation.pam_value',
    'Publication.title',
    'Publication.year',
    'Publication.doi'
  ];

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { headers: [], data: [], rawLines: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    return { headers, data: lines.slice(1), rawLines: lines };
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setValidationErrors(['Please select a CSV file for the main data']);
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setUploadStatus(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const { headers, data } = parseCSV(csvText);
      
      setHeaders(headers);
      setCsvData({ data });
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !authData.authenticated) return;

    setIsUploading(true);
    setUploadStatus(null);
    setUploadComplete(false);

    try {
      // Get fresh CSRF token
      const csrfResponse = await axios.get(`${backendUrl}/api/auth/csrf/`, {
        withCredentials: true,
      });

      const formData = new FormData();
      formData.append('csv_file', file, file.name);

      const response = await axios.post(`${backendUrl}/api/auth/upload-csv/`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': csrfResponse.data.csrfToken,
        },
      });

      setUploadStatus({ 
        type: 'success', 
        message: response.data?.message || 'Your files have been successfully uploaded and are now queued for processing. You can upload another dataset or navigate away from this page.' 
      });
      setUploadComplete(true);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Upload failed' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setCsvData({ data: [] });
    setHeaders([]);
    setValidationErrors([]);
    setUploadStatus(null);
    setUploadComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const shinyUrl = (() => {
    const envUrl = process.env.REACT_APP_SHINY_URL;
    if (envUrl) return envUrl;
    try {
      const urlObj = new URL(window.location.origin);
      // Use /shiny/ path instead of port 3838
      urlObj.pathname = '/shiny/';
      return urlObj.toString();
    } catch {
      return 'http://localhost:8000/shiny/';
    }
  })();

  const InputSidebar = () => (
    <Card className="h-100 border-0 shadow-sm" style={{ backgroundColor: '#f8fafc' }}>
      <Card.Header className="border-0" style={{ backgroundColor: '#3b82f6', borderRadius: '0.5rem 0.5rem 0 0' }}>
        <div className="d-flex align-items-center">
          <h5 className="mb-0 text-white fw-normal">Upload Workflow</h5>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <p className="text-muted mb-4 lh-base">
          Import coral stress-experiment results into the Coral Future database with our guided process.
        </p>
        
        <div className="workflow-steps">
            <div className="step mb-4">
              <div className="d-flex align-items-start">
                <div className="step-number me-3 mt-1">
                  <span className="badge bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', fontSize: '12px' }}>1</span>
                </div>
                <div className="flex-grow-1">
                  <h6 className="fw-semibold text-dark mb-2">Prepare Your Data</h6>
                  <p className="text-muted small lh-base">
                    CSV file with coral stress experiment data including Site, Condition, Species, Timepoint, Temperature, and PAM values.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="step mb-4">
              <div className="d-flex align-items-start">
                <div className="step-number me-3 mt-1">
                  <span className="badge bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', fontSize: '12px' }}>2</span>
                </div>
                <div className="flex-grow-1">
                  <h6 className="fw-semibold text-dark mb-2">Upload & Auto-Calculate</h6>
                  <p className="text-muted small lh-base">
                    Upload your CSV. System will automatically calculate ED5/ED50/ED95 if not included.
                  </p>
                </div>
              </div>
            </div>
            
        </div>
        
        <div className="mt-4 pt-4 border-top">
          <p className="text-muted small lh-base mb-0">
            <span className="fw-medium">Need help?</span> Large files are supported with progress tracking. 
            Contact us via "Get Help" for special data structures.
          </p>
        </div>
      </Card.Body>
    </Card>
  );

  return (
    <div style={{ backgroundColor: '#fafbfc', minHeight: '100vh' }}>
      <Container className="py-5" style={{ maxWidth: '1400px' }}>
        <Row className="justify-content-center">
          <Col md={12}>
            <div className="text-center mb-5 mt-3">
              <h1 className="display-6 fw-light text-dark mb-3">Upload Coral Research Data</h1>
              <p className="lead text-muted fw-normal mb-4">
                Upload and validate your CSV data files for coral thermal tolerance research
              </p>
              {authData.authenticated ? (
                <div className="d-inline-flex align-items-center px-3 py-2 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-pill">
                  <span className="text-success fw-medium">Logged in as {authData.username}</span>
                </div>
              ) : (
                <div className="d-inline-flex align-items-center px-3 py-2 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-pill">
                  <span className="text-warning fw-medium">Please log in to upload data</span>
                </div>
              )}
            </div>
            
            {uploadStatus && (
              <Row className="justify-content-center mb-4">
                <Col lg={8}>
                  <Alert 
                    variant={uploadStatus.type === 'success' ? 'success' : 'danger'} 
                    className="border-0 shadow-sm"
                    style={{ 
                      backgroundColor: uploadStatus.type === 'success' ? '#d1f2eb' : '#fadbd8',
                      borderLeft: `4px solid ${uploadStatus.type === 'success' ? '#27ae60' : '#e74c3c'}`
                    }}
                  >
                    <div className="fw-medium">{uploadStatus.message}</div>
                  </Alert>
                </Col>
              </Row>
            )}
          </Col>
        </Row>
        
        <Row className="g-4">
          <Col lg={4}>
            <InputSidebar />
          </Col>
          
          <Col lg={8}>
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="border-0 bg-white py-4">
                <h5 className="mb-0 fw-normal text-dark">File Upload</h5>
              </Card.Header>
              <Card.Body className="px-4 pb-4">
                {uploadComplete ? (
                  <div className="text-center py-5">
                    <h3 className="mb-3 fw-normal">Upload Successful</h3>
                    <p className="text-muted lead px-4" style={{ fontSize: '1.1rem' }}>
                      {uploadStatus?.message || 'Your files have been queued for processing.'}
                    </p>
                    <Button 
                      variant="primary" 
                      size="lg" 
                      onClick={handleClear} 
                      className="mt-4 px-5 fw-medium shadow-sm"
                      style={{ borderRadius: '8px' }}
                    >
                      Upload Another Dataset
                    </Button>
                  </div>
                ) : (
                <>
                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-4">
                        <Form.Label className="fw-medium text-dark mb-3">Select Your CSV Data File</Form.Label>
                        <div 
                          className="upload-zone position-relative text-center d-flex flex-column justify-content-center"
                          style={{
                              border: `2px dashed ${file ? '#27ae60' : '#cbd5e1'}`,
                              borderRadius: '12px',
                              padding: '2rem',
                              minHeight: '200px',
                              backgroundColor: file ? '#eafaf1' : '#fafbfc',
                              transition: 'all 0.2s ease',
                          }}
                        >
                            <div className="upload-icon" style={{ fontSize: '3rem', color: file ? '#27ae60' : '#6c757d', lineHeight: 1 }}>
                                {file ? '✓' : ''}
                            </div>
                            <div className="mt-3">
                                {file ? (
                                    <>
                                        <p className="mb-0 fw-medium text-dark" style={{ wordBreak: 'break-all' }}>{file.name}</p>
                                        <p className="mb-0 text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                                        <p className="mb-0 text-success mt-2 small">ED values will be auto-calculated if not present</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-1 text-dark fw-medium">Drop your CSV file here or click to browse</p>
                                        <p className="mb-0 text-muted small">System will auto-calculate EDs and map columns automatically</p>
                                    </>
                                )}
                            </div>

                            <Form.Control 
                                type="file" 
                                accept=".csv"
                                onChange={handleFileSelect}
                                ref={fileInputRef}
                                className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>


                  {validationErrors.length > 0 && (
                    <Alert variant="danger" className="border-0 shadow-sm mb-4">
                      <Alert.Heading className="h6 fw-medium">Validation Errors</Alert.Heading>
                      <ul className="mb-0 ps-3">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="small">{error}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  {isUploading && (
                    <div className="mb-4">
                      <div className="d-flex align-items-center mb-3">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        <span className="fw-medium text-dark">
                          Uploading and processing your data...
                        </span>
                      </div>
                      <ProgressBar 
                        animated 
                        now={100} 
                        variant="primary" 
                        style={{ height: '8px', borderRadius: '4px' }}
                      />
                    </div>
                  )}

                  {(() => {
                    const canUpload = file && authData.authenticated && !isUploading;
                    if (!authData.authenticated) return null;
                    
                    return (
                      <div className="d-flex gap-3 mt-4 pt-4 border-top">
                        <Button 
                          variant="primary" 
                          size="lg"
                          onClick={handleUpload}
                          disabled={!canUpload}
                          className="px-5 fw-medium shadow-sm"
                          style={{ borderRadius: '8px' }}
                        >
                          {isUploading ? 'Processing...' : 'Upload & Process Data'}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="lg"
                          onClick={handleClear}
                          disabled={isUploading}
                          className="px-4 fw-medium"
                          style={{ borderRadius: '8px' }}
                        >
                          Clear
                        </Button>
                      </div>
                    );
                  })()}
                </>
                )}
              </Card.Body>
            </Card>

            {/* Data preview */}
            {!uploadComplete && csvData.data && csvData.data.length > 0 && headers.length > 0 && (
              <Card className="border-0 shadow-sm">
                <Card.Header className="border-0 bg-info bg-opacity-10 py-4">
                  <div className="d-flex align-items-center justify-content-between">
                    <h5 className="mb-0 fw-normal text-dark">Data Preview</h5>
                    <div className="text-muted small">
                      {csvData.data.length} rows • {headers.length} columns
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <div 
                    className="table-responsive"
                    style={{ 
                      maxHeight: '600px', 
                      overflowY: 'auto', 
                      overflowX: 'auto',
                      borderRadius: '0 0 0.5rem 0.5rem'
                    }}
                  >
                    <Table hover className="mb-0" style={{ minWidth: `${headers.length * 150}px` }}>
                      <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          {headers.map(header => (
                            <th 
                              key={header} 
                              className="border-0 text-nowrap py-3 px-3" 
                              style={{ 
                                minWidth: '150px',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#374151'
                              }}
                            >
                              {header}
                              {requiredFields.includes(header) && 
                                <span className="text-danger ms-1">*</span>
                              }
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.data.slice(0, 50).map((line, index) => {
                          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {headers.map((header, idx) => (
                                <td 
                                  key={idx} 
                                  className="py-2 px-3" 
                                  style={{ 
                                    minWidth: '150px', 
                                    maxWidth: '200px', 
                                    wordWrap: 'break-word',
                                    fontSize: '0.875rem',
                                    color: values[idx] ? '#374151' : '#9ca3af'
                                  }}
                                >
                                  {values[idx] || <span className="fst-italic">empty</span>}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {csvData.data.length > 50 && (
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <td 
                              colSpan={headers.length} 
                              className="text-center py-4 text-muted fst-italic"
                              style={{ fontSize: '0.875rem' }}
                            >
                              ... and {csvData.data.length - 50} more rows (showing first 50 for performance)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                  <div className="px-4 py-3 bg-light border-top">
                    <div className="d-flex align-items-center justify-content-between">
                      <small className="text-muted">
                        Use horizontal and vertical scrolling to view all data
                      </small>
                      <small className="text-muted fw-medium">
                        Showing {Math.min(50, csvData.data.length)} of {csvData.data.length} rows
                      </small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default UploadDataPage;
