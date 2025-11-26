import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table, Nav, Pagination, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

const ED50CalculatorPage = () => {
  const [file, setFile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('plots');
  const [dataView, setDataView] = useState('aggregated'); // 'aggregated' or 'individual'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  const [settings, setSettings] = useState({
    grouping_properties: 'Site,Condition,Species,Timepoint',
    drm_formula: 'Pam_value ~ Temperature',
    condition: 'Condition',
    faceting: ' ~ Species',
    faceting_model: 'Species ~ Site ~ Condition',
    size_text: 10,
    size_points: 1
  });

  const apiUrl = process.env.REACT_APP_ED50_API_URL || '/shiny';

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setResults(null);
  };

  const isInitialMount = useRef(true);
  const lastProcessedSettings = useRef(null);

  const processData = async (currentSettings) => {
    if (!file) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.keys(currentSettings).forEach(key => {
        formData.append(key, currentSettings[key]);
      });

      const response = await axios.post(`${apiUrl}/process`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'text'
      });

      // Parse HTML response to extract data
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'text/html');
      
      // Extract CSV data
      const csvTextarea = doc.getElementById('csvData');
      const csvData = csvTextarea ? csvTextarea.textContent : '';
      
      // Parse CSV properly handling quoted values
      const parseCSV = (csvText) => {
        const lines = csvText.split('\n').filter(l => l.trim());
        if (lines.length === 0) return { headers: [], rows: [] };
        
        // Parse headers
        const parseLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseLine(lines[0]);
        const rows = lines.slice(1).map(line => {
          const values = parseLine(line);
          return headers.reduce((obj, header, idx) => {
            obj[header] = values[idx] || '';
            return obj;
          }, {});
        });
        
        return { headers, rows };
      };
      
      // Split CSV into aggregated and individual tables
      const csvLines = csvData.split('\n');
      const aggregatedSeparatorIndex = csvLines.findIndex(line => line.includes('#AGGREGATED_STATISTICS'));
      
      let aggregatedData = { headers: [], rows: [] };
      let individualData = { headers: [], rows: [] };
      
      if (aggregatedSeparatorIndex >= 0) {
        // Format: individual first, then aggregated
        const individualCSV = csvLines.slice(0, aggregatedSeparatorIndex).join('\n');
        individualData = parseCSV(individualCSV);
        
        const aggregatedCSV = csvLines.slice(aggregatedSeparatorIndex + 1).join('\n');
        aggregatedData = parseCSV(aggregatedCSV);
      } else {
        // No separator: assume it's individual data only
        individualData = parseCSV(csvData);
      }
      
      // Define expected column order for aggregated table
      const expectedAggregatedColumns = [
        'Site', 'Condition', 'Species', 'Timepoint',
        'Mean_ED5', 'SD_ED5', 'SE_ED5', 'Conf_Int_5',
        'Mean_ED50', 'SD_ED50', 'SE_ED50', 'Conf_Int_50',
        'Mean_ED95', 'SD_ED95', 'SE_ED95', 'Conf_Int_95'
      ];
      
      // Reorder aggregated columns
      const orderedAggregatedHeaders = expectedAggregatedColumns.filter(col => aggregatedData.headers.includes(col))
        .concat(aggregatedData.headers.filter(col => !expectedAggregatedColumns.includes(col)));
      
      const orderedAggregatedRows = aggregatedData.rows.map(row => {
        const orderedRow = {};
        orderedAggregatedHeaders.forEach(header => {
          orderedRow[header] = row[header] || '';
        });
        return orderedRow;
      });
      
      // Order individual table columns (ED5, ED50, ED95, then grouping properties)
      const expectedIndividualColumns = ['ED5', 'ED50', 'ED95', 'GroupingProperty'];
      const orderedIndividualHeaders = expectedIndividualColumns.filter(col => individualData.headers.includes(col))
        .concat(individualData.headers.filter(col => !expectedIndividualColumns.includes(col)));
      
      const orderedIndividualRows = individualData.rows.map(row => {
        const orderedRow = {};
        orderedIndividualHeaders.forEach(header => {
          orderedRow[header] = row[header] || '';
        });
        return orderedRow;
      });

      // Extract images
      const boxplotImg = doc.querySelector('img[alt="ED50 Boxplot"]')?.src || '';
      const tempCurveImg = doc.querySelector('img[alt="Temperature Response Curves"]')?.src || '';
      const modelCurveImg = doc.querySelector('img[alt="Model Curve Plot"]')?.src || '';

      setResults({
        aggregatedTable: orderedAggregatedRows,
        aggregatedHeaders: orderedAggregatedHeaders,
        individualTable: orderedIndividualRows,
        individualHeaders: orderedIndividualHeaders,
        boxplot: boxplotImg,
        tempCurve: tempCurveImg,
        modelCurve: modelCurveImg,
        csvData
      });
      setActiveTab((boxplotImg || tempCurveImg || modelCurveImg) ? 'plots' : 'data');
      if (!results) {
        setDataView('individual'); // Default to individual view (first table)
        setSearchTerm('');
        setSortColumn(null);
        setSortDirection('asc');
        setCurrentPage(1);
      }
      lastProcessedSettings.current = { ...currentSettings };
    } catch (err) {
      setError(err.response?.data || err.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    setResults(null);
    await processData(settings);
  };

  // Auto-reprocess when size_text or size_points change (if file is loaded and results exist)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (file && results && (lastProcessedSettings.current?.size_text !== settings.size_text || 
                           lastProcessedSettings.current?.size_points !== settings.size_points)) {
      processData(settings);
    }
  }, [settings.size_text, settings.size_points]);

  const downloadTable = (table, headers, filename) => {
    if (!table || !headers || table.length === 0) return;
    const csv = [
      headers.join(','),
      ...table.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = (base64Data, filename) => {
    if (!base64Data) return;
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    link.click();
  };

  // Filter, sort and paginate data
  const filteredAndPaginatedData = useMemo(() => {
    const table = dataView === 'aggregated' ? results?.aggregatedTable : results?.individualTable;
    const headers = dataView === 'aggregated' ? results?.aggregatedHeaders : results?.individualHeaders;
    
    if (!table || !headers) return { filtered: [], paginated: [], totalPages: 0 };

    // Apply search filter
    let filtered = table;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        headers.some(header => {
          const value = String(row[header] || '').toLowerCase();
          return value.includes(searchLower);
        })
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';
        
        // Try to parse as numbers
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { filtered, paginated, totalPages, headers };
  }, [results, dataView, searchTerm, sortColumn, sortDirection, currentPage, itemsPerPage]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container className="mt-5" style={{ marginTop: '3rem' }}>
      <Row>
        <Col>
          <h1 className="mb-4 mt-5">CBASS ED Calculator</h1>
        </Col>
      </Row>

      <Row>
        <Col md={3}>
          <div style={{ position: 'sticky', top: '2px' }}>
            <Card>
              <Card.Body>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Select file</Form.Label>
                    <Form.Control
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileChange}
                      required
                    />
                    <Form.Text>CSV and Excel files supported</Form.Text>
                  </Form.Group>

                  <Button
                    variant="outline-primary"
                    className="mb-3 w-100"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowSettings(!showSettings);
                    }}
                  >
                    {showSettings ? 'Hide' : 'Show'} Settings
                  </Button>

                  {showSettings && (
                    <div className="mb-3">
                      <Form.Group className="mb-3">
                        <Form.Label>Grouping properties</Form.Label>
                        <Form.Control
                          value={settings.grouping_properties}
                          onChange={(e) => handleSettingChange('grouping_properties', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Faceting model</Form.Label>
                        <Form.Control
                          value={settings.faceting_model}
                          onChange={(e) => handleSettingChange('faceting_model', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Faceting</Form.Label>
                        <Form.Control
                          value={settings.faceting}
                          onChange={(e) => handleSettingChange('faceting', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Condition</Form.Label>
                        <Form.Control
                          value={settings.condition}
                          onChange={(e) => handleSettingChange('condition', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>DRM formula</Form.Label>
                        <Form.Control
                          value={settings.drm_formula}
                          onChange={(e) => handleSettingChange('drm_formula', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Text size: {settings.size_text}</Form.Label>
                        <Form.Range
                          min="6"
                          max="20"
                          step="0.5"
                          value={settings.size_text}
                          onChange={(e) => handleSettingChange('size_text', parseFloat(e.target.value))}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Point size: {settings.size_points}</Form.Label>
                        <Form.Range
                          min="1"
                          max="6"
                          step="0.25"
                          value={settings.size_points}
                          onChange={(e) => handleSettingChange('size_points', parseFloat(e.target.value))}
                        />
                      </Form.Group>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-100"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Process data'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </div>
        </Col>

        <Col md={9}>
          <Card className="mb-4">
            <Card.Body>
              <h5>Instructions</h5>
              <ol>
                <li>Upload your CSV or Excel file</li>
                <li>Click "Show Settings" to change analysis parameters</li>
                <li>Click "Process data" to start analysis</li>
              </ol>
              <Alert variant="info" className="mt-3">
                <strong>What the application does:</strong>
                <ul className="mb-0">
                  <li>Calculates ED5, ED50, ED95 values for each group</li>
                  <li>Creates boxplot for ED50 values</li>
                  <li>Plots temperature response curves</li>
                  <li>Provides results table for download</li>
                </ul>
              </Alert>
              <Button 
                size="sm" 
                variant="outline-primary" 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/WorkShop_template.csv';
                  link.download = 'WorkShop_template.csv';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download Template CSV
              </Button>
            </Card.Body>
          </Card>

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          {results && (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Analysis Results</h5>
              </Card.Header>
              <Card.Body>
                <Nav variant="tabs" className="mb-3">
                  {(results.boxplot || results.tempCurve || results.modelCurve) && (
                    <Nav.Item>
                      <Nav.Link
                        className={activeTab === 'plots' ? 'active' : ''}
                        onClick={() => setActiveTab('plots')}
                        style={{ cursor: 'pointer' }}
                      >
                        Plots
                      </Nav.Link>
                    </Nav.Item>
                  )}
                  <Nav.Item>
                    <Nav.Link
                      className={activeTab === 'data' ? 'active' : ''}
                      onClick={() => setActiveTab('data')}
                      style={{ cursor: 'pointer' }}
                    >
                      Data
                    </Nav.Link>
                  </Nav.Item>
                </Nav>

                {activeTab === 'plots' && (results.boxplot || results.tempCurve || results.modelCurve) && (
                  <div style={{ maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                    {results.boxplot && (
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">ED50s Boxplot</h6>
                          <Button size="sm" variant="outline-primary" onClick={() => downloadImage(results.boxplot, 'ed50_boxplot.png')}>
                            Download
                          </Button>
                        </div>
                        <img src={results.boxplot} alt="ED50 Boxplot" className="img-fluid" />
                      </div>
                    )}
                    {results.tempCurve && (
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Temperature Response Curves</h6>
                          <Button size="sm" variant="outline-primary" onClick={() => downloadImage(results.tempCurve, 'temperature_curves.png')}>
                            Download
                          </Button>
                        </div>
                        <img src={results.tempCurve} alt="Temperature Response Curves" className="img-fluid" />
                      </div>
                    )}
                    {results.modelCurve && (
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Model Curve with ED bands</h6>
                          <Button size="sm" variant="outline-primary" onClick={() => downloadImage(results.modelCurve, 'model_curve.png')}>
                            Download
                          </Button>
                        </div>
                        <img src={results.modelCurve} alt="Model Curve Plot" className="img-fluid" />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'data' && (
                  <div>
                    {/* View selector */}
                    {results.individualTable && results.individualTable.length > 0 && (
                      <div className="mb-3">
                        <Nav variant="pills" className="mb-3">
                          <Nav.Item>
                            <Nav.Link
                              active={dataView === 'individual'}
                              onClick={() => {
                                setDataView('individual');
                                setCurrentPage(1);
                                setSortColumn(null);
                              }}
                            >
                              Individual Values
                            </Nav.Link>
                          </Nav.Item>
                          {results.aggregatedTable && results.aggregatedTable.length > 0 && (
                            <Nav.Item>
                              <Nav.Link
                                active={dataView === 'aggregated'}
                                onClick={() => {
                                  setDataView('aggregated');
                                  setCurrentPage(1);
                                  setSortColumn(null);
                                }}
                              >
                                Aggregated Statistics
                              </Nav.Link>
                            </Nav.Item>
                          )}
                        </Nav>
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <InputGroup style={{ flex: 1, maxWidth: '400px' }}>
                          <InputGroup.Text>🔍</InputGroup.Text>
                          <Form.Control
                            type="text"
                            placeholder="Search by any column..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                          />
                          {searchTerm && (
                            <Button
                              variant="outline-secondary"
                              onClick={() => handleSearch('')}
                            >
                              Clear
                            </Button>
                          )}
                        </InputGroup>
                        <Button 
                          size="sm" 
                          variant="outline-success"
                          onClick={() => {
                            const table = dataView === 'aggregated' ? results.aggregatedTable : results.individualTable;
                            const headers = dataView === 'aggregated' ? results.aggregatedHeaders : results.individualHeaders;
                            const filename = `${dataView === 'aggregated' ? 'aggregated' : 'individual'}_values_${new Date().toISOString().split('T')[0]}.csv`;
                            downloadTable(table, headers, filename);
                          }}
                        >
                          Download {dataView === 'aggregated' ? 'Aggregated' : 'Individual'} CSV
                        </Button>
                      </div>
                      <div className="text-muted small">
                        Showing {filteredAndPaginatedData.paginated.length} of {filteredAndPaginatedData.filtered.length} rows
                        {sortColumn && (
                          <span className="ms-2">
                            (Sorted by {sortColumn} {sortDirection === 'asc' ? '↑' : '↓'})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto', overflowX: 'auto', overscrollBehavior: 'contain' }}>
                      <Table striped hover style={{ minWidth: '100%' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
                          <tr>
                            {filteredAndPaginatedData.headers?.map(h => (
                              <th 
                                key={h} 
                                onClick={() => handleSort(h)}
                                style={{ 
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  padding: '0.75rem'
                                }}
                                className={sortColumn === h ? 'bg-light' : ''}
                              >
                                <div className="d-flex align-items-center justify-content-between">
                                  <span>{h}</span>
                                  {sortColumn === h && (
                                    <span className="ms-2">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndPaginatedData.paginated.length === 0 ? (
                            <tr>
                              <td colSpan={filteredAndPaginatedData.headers?.length || 1} className="text-center text-muted py-4">
                                No data found matching your search
                              </td>
                            </tr>
                          ) : (
                            filteredAndPaginatedData.paginated.map((row, idx) => (
                              <tr key={idx}>
                                {filteredAndPaginatedData.headers?.map(h => {
                                  const value = row[h] || '';
                                  // Format numeric values for ED columns
                                  const isNumericColumn = h.includes('Mean_ED') || 
                                                         h.includes('SD_ED') || 
                                                         h.includes('SE_ED') || 
                                                         h.includes('Conf_Int') ||
                                                         h === 'ED5' || h === 'ED50' || h === 'ED95';
                                  let displayValue = value;
                                  
                                  if (isNumericColumn && value !== '') {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      // Format to 2 decimal places for better readability
                                      displayValue = numValue.toFixed(2);
                                    }
                                  }
                                  
                                  return (
                                    <td key={h} style={{ whiteSpace: 'nowrap', textAlign: isNumericColumn ? 'right' : 'left' }}>
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>

                    {filteredAndPaginatedData.filtered.length > 0 && (
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div className="text-muted small">
                          Page {currentPage} of {filteredAndPaginatedData.totalPages} ({filteredAndPaginatedData.filtered.length} total rows)
                        </div>
                        {filteredAndPaginatedData.totalPages > 1 && (
                          <Pagination className="mb-0">
                            <Pagination.First
                              onClick={() => handlePageChange(1)}
                              disabled={currentPage === 1}
                            />
                            <Pagination.Prev
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                            />
                            {[...Array(Math.min(5, filteredAndPaginatedData.totalPages))].map((_, i) => {
                              let pageNum;
                              if (filteredAndPaginatedData.totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= filteredAndPaginatedData.totalPages - 2) {
                                pageNum = filteredAndPaginatedData.totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              return (
                                <Pagination.Item
                                  key={pageNum}
                                  active={pageNum === currentPage}
                                  onClick={() => handlePageChange(pageNum)}
                                >
                                  {pageNum}
                                </Pagination.Item>
                              );
                            })}
                            <Pagination.Next
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === filteredAndPaginatedData.totalPages}
                            />
                            <Pagination.Last
                              onClick={() => handlePageChange(filteredAndPaginatedData.totalPages)}
                              disabled={currentPage === filteredAndPaginatedData.totalPages}
                            />
                          </Pagination>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default ED50CalculatorPage;

