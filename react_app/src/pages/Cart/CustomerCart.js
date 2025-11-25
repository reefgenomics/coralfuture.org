import React, { useState, useContext, useMemo } from 'react';
import { 
  Container, Row, Col, Card, Button, 
  Form, Badge, Alert, Spinner, Modal,
  Table, InputGroup, Dropdown
} from 'react-bootstrap';
import { Trash3, Pencil, Download, CheckCircle, SortDown, SortUp, Search } from 'react-bootstrap-icons';
import { UserCartContext } from 'contexts/UserCartContext';
import { AuthContext } from 'contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';

const CustomerCart = () => {
  const { authData } = useContext(AuthContext);
  const { 
    cartGroups, 
    loading, 
    deleteCartGroup, 
    renameCartGroup, 
    exportCartGroups,
    refreshCart
  } = useContext(UserCartContext);

  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Load cart data when user is authenticated
  React.useEffect(() => {
    if (authData.authenticated) {
      refreshCart();
    }
  }, [authData.authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize all groups as selected
  React.useEffect(() => {
    if (cartGroups.length > 0 && selectedGroups.size === 0) {
      setSelectedGroups(new Set(cartGroups.map(group => group.id)));
    }
  }, [cartGroups, selectedGroups.size]);

  // Filtered and sorted cart groups
  const filteredAndSortedGroups = useMemo(() => {
    let filtered = cartGroups.filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.species?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.country?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort groups
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'colony_count':
          aVal = a.colony_count;
          bVal = b.colony_count;
          break;
        case 'created_at':
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
          break;
        default:
          aVal = a[sortField];
          bVal = b[sortField];
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [cartGroups, searchTerm, sortField, sortDirection]);

  const handleGroupSelection = (groupId, checked) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupId);
    } else {
      newSelected.delete(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedGroups(new Set(filteredAndSortedGroups.map(group => group.id)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleGroupExpansion = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleRename = (group) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setShowRenameModal(true);
  };

  const saveRename = async () => {
    if (editingGroup && newGroupName.trim()) {
      try {
        await renameCartGroup(editingGroup.id, newGroupName.trim(), '');
        setShowRenameModal(false);
        setEditingGroup(null);
        setNewGroupName('');
      } catch (error) {
        console.error('Error renaming group:', error);
      }
    }
  };

  const handleDelete = async (groupId) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await deleteCartGroup(groupId, '');
      } catch (error) {
        console.error('Error deleting group:', error);
      }
    }
  };

  const handleExport = async (exportAll = false) => {
    setExporting(true);
    try {
      const groupIds = exportAll ? [] : Array.from(selectedGroups);
      await exportCartGroups(groupIds, exportAll, '');
    } catch (error) {
      console.error('Error exporting cart:', error);
    } finally {
      setExporting(false);
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortUp /> : <SortDown />;
  };

  const renderColonyTable = (colonies) => {
    if (!colonies || colonies.length === 0) return <p className="text-muted">No colonies in this group</p>;

    return (
      <div className="position-relative">
        <div className="table-responsive" style={{ 
          overflowX: 'auto', 
          width: '100%',
          maxWidth: '100%',
          border: '1px solid #dee2e6',
          borderRadius: '0.375rem',
          boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
          WebkitOverflowScrolling: 'touch'
        }}>
          <Table striped bordered hover size="sm" className="mt-3 mb-0" style={{
            minWidth: '1600px',
            width: '100%',
            marginBottom: 0
          }}>
            <thead className="table-light">
              <tr>
                <th style={{
                  width: '150px',
                  minWidth: '150px',
                  maxWidth: '150px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f8f9fa',
                  zIndex: 10,
                  borderRight: '2px solid #dee2e6'
                }}>Colony</th>
                <th style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>Species</th>
                <th style={{width: '140px', minWidth: '140px', maxWidth: '140px'}}>Location</th>
                <th style={{width: '180px', minWidth: '180px', maxWidth: '180px'}}>Biosamples</th>
                <th style={{width: '300px', minWidth: '300px', maxWidth: '300px'}}>Thermal Tolerance (ED50)</th>
                <th style={{width: '300px', minWidth: '300px', maxWidth: '300px'}}>Breakpoint Temp (ED5)</th>
                <th style={{width: '300px', minWidth: '300px', maxWidth: '300px'}}>Thermal Limit (ED95)</th>
              </tr>
            </thead>
          <tbody>
            {colonies.map((colonyData) => {
              const colony = colonyData.colony;
              const biosampleCount = colonyData.biosamples?.length || 0;
              
              return (
                <tr key={colony.id}>
                  <td style={{
                    verticalAlign: 'top',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'white',
                    zIndex: 5,
                    borderRight: '2px solid #dee2e6',
                    fontWeight: '500',
                    width: '150px',
                    minWidth: '150px',
                    maxWidth: '150px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    <strong>{colony.name}</strong>
                    <br />
                    <small className="text-muted">ID: {colony.id}</small>
                  </td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '120px',
                    minWidth: '120px',
                    maxWidth: '120px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>{colony.species}</td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '140px',
                    minWidth: '140px',
                    maxWidth: '140px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    {colony.country}
                    <br />
                    <small className="text-muted">
                      {colony.latitude.toFixed(4)}, {colony.longitude.toFixed(4)}
                    </small>
                  </td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    <Badge bg="info">{biosampleCount}</Badge>
                    {biosampleCount > 0 && (
                      <div className="mt-1">
                        <small className="text-muted">
                          {colonyData.biosamples[0]?.name || 'N/A'}
                          {biosampleCount > 1 && ` +${biosampleCount - 1} more`}
                        </small>
                      </div>
                    )}
                  </td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    {colonyData.thermal_tolerances?.length > 0 ? (
                      <div>
                        {colonyData.thermal_tolerances.map((tt, idx) => (
                          <div key={tt.id} className="mb-2 p-2 border rounded bg-light" style={{fontSize: '0.8rem'}}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <strong className="text-primary">#{tt.id}</strong>
                              <small className="text-muted">{tt.condition || 'N/A'}</small>
                            </div>
                            <div className="row g-1">
                              <div className="col-6">
                                <small><strong>Abs:</strong> {tt.abs_thermal_tolerance?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-6">
                                <small><strong>Rel:</strong> {tt.rel_thermal_tolerance?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>MMM:</strong> {tt.sst_clim_mmm?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>Time:</strong> {tt.timepoint || 'N/A'}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No data</span>
                    )}
                  </td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    {colonyData.breakpoint_temperatures?.length > 0 ? (
                      <div>
                        {colonyData.breakpoint_temperatures.map((bt, idx) => (
                          <div key={bt.id} className="mb-2 p-2 border rounded bg-light" style={{fontSize: '0.8rem'}}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <strong className="text-success">#{bt.id}</strong>
                              <small className="text-muted">{bt.condition || 'N/A'}</small>
                            </div>
                            <div className="row g-1">
                              <div className="col-6">
                                <small><strong>Abs:</strong> {bt.abs_breakpoint_temperature?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-6">
                                <small><strong>Rel:</strong> {bt.rel_breakpoint_temperature?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>MMM:</strong> {bt.sst_clim_mmm?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>Time:</strong> {bt.timepoint || 'N/A'}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No data</span>
                    )}
                  </td>
                  <td style={{
                    verticalAlign: 'top',
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px',
                    wordWrap: 'break-word',
                    overflow: 'hidden'
                  }}>
                    {colonyData.thermal_limits?.length > 0 ? (
                      <div>
                        {colonyData.thermal_limits.map((tl, idx) => (
                          <div key={tl.id} className="mb-2 p-2 border rounded bg-light" style={{fontSize: '0.8rem'}}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <strong className="text-warning">#{tl.id}</strong>
                              <small className="text-muted">{tl.condition || 'N/A'}</small>
                            </div>
                            <div className="row g-1">
                              <div className="col-6">
                                <small><strong>Abs:</strong> {tl.abs_thermal_limit?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-6">
                                <small><strong>Rel:</strong> {tl.rel_thermal_limit?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>MMM:</strong> {tl.sst_clim_mmm?.toFixed(2) || 'N/A'}°C</small>
                              </div>
                              <div className="col-12">
                                <small><strong>Time:</strong> {tl.timepoint || 'N/A'}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No data</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        </div>
        <div className="text-center mt-2">
          <small className="text-muted">
            <i className="bi bi-arrow-left-right me-1"></i>
            Scroll horizontally to view all data
          </small>
        </div>
      </div>
    );
  };

  if (!authData.authenticated) {
    return (
      <Container className="my-5 text-center">
        <Alert variant="warning">
          <h4>Please log in to view your cart</h4>
          <p>You need to be logged in to access your research cart.</p>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="my-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading cart...</p>
      </Container>
    );
  }

  return (
    <Container className="my-5">
        <style>
          {`
            .table-responsive {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
            }
            .table-responsive::-webkit-scrollbar {
              height: 8px;
            }
            .table-responsive::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 4px;
            }
            .table-responsive::-webkit-scrollbar-thumb {
              background: #c1c1c1;
              border-radius: 4px;
            }
            .table-responsive::-webkit-scrollbar-thumb:hover {
              background: #a8a8a8;
            }
          `}
        </style>
        <Row className="mb-4">
          <Col>
            <h1 className="text-center mb-3">Research Cart</h1>
            <p className="text-center text-muted">
              Organize and export your coral research data
            </p>
          </Col>
        </Row>

        {/* Export Controls */}
        {cartGroups.length > 0 && (
          <Row className="mb-4">
            <Col>
              <Card className="border-primary">
                <Card.Body>
                  <Row className="align-items-center">
                    <Col md={6}>
                      <Form.Check
                        type="checkbox"
                        label="Select All Groups"
                        checked={selectedGroups.size === filteredAndSortedGroups.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      <small className="text-muted d-block mt-1">
                        {selectedGroups.size} of {filteredAndSortedGroups.length} groups selected
                      </small>
                    </Col>
                    <Col md={6} className="text-end">
                      <Button
                        variant="outline-primary"
                        onClick={() => handleExport(true)}
                        disabled={exporting}
                        className="me-2"
                      >
                        {exporting ? <Spinner animation="border" size="sm" /> : <Download />}
                        Export All
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleExport(false)}
                        disabled={selectedGroups.size === 0 || exporting}
                      >
                        {exporting ? <Spinner animation="border" size="sm" /> : <Download />}
                        Export Selected
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Search and Controls */}
        {cartGroups.length > 0 && (
          <Row className="mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search groups by name, species, or country..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6} className="text-end">
              <Dropdown>
                <Dropdown.Toggle variant="outline-secondary" size="sm">
                  Sort by: {sortField.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => handleSort('name')}>
                    Name {renderSortIcon('name')}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleSort('colony_count')}>
                    Colony Count {renderSortIcon('colony_count')}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleSort('created_at')}>
                    Date Created {renderSortIcon('created_at')}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>
        )}

        {/* Cart Groups Table */}
        {filteredAndSortedGroups.length > 0 ? (
          <Card>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '50px' }}>
                      <Form.Check
                        type="checkbox"
                        checked={selectedGroups.size === filteredAndSortedGroups.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>Group Name</th>
                    <th>Colonies</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedGroups.map((group) => (
                    <React.Fragment key={group.id}>
                      <tr>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedGroups.has(group.id)}
                            onChange={(e) => handleGroupSelection(group.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <Button
                              variant="link"
                              className="p-0 me-2 text-decoration-none"
                              onClick={() => toggleGroupExpansion(group.id)}
                            >
                              {expandedGroups.has(group.id) ? '▼' : '▶'}
                            </Button>
                            <strong>{group.name}</strong>
                          </div>
                        </td>
                        <td>
                          <Badge bg="secondary">{group.colony_count}</Badge>
                        </td>
                        <td>
                          <small className="text-muted">
                            {new Date(group.created_at).toLocaleDateString()}
                          </small>
                        </td>
                        <td>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => handleRename(group)}
                            className="me-2"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDelete(group.id)}
                          >
                            <Trash3 />
                          </Button>
                        </td>
                      </tr>
                      {expandedGroups.has(group.id) && (
                        <tr>
                          <td colSpan="5" className="p-0">
                            <div className="p-3 bg-light" style={{ overflowX: 'auto' }}>
                              {renderColonyTable(group.colonies)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        ) : cartGroups.length === 0 ? (
          <Alert variant="info" className="text-center">
            <CheckCircle size={48} className="mb-3" />
            <h4>Your cart is empty</h4>
            <p>
              Use the map page to filter colonies and add them to your research cart.
              Each filter selection will create a new group that you can organize and export.
            </p>
          </Alert>
        ) : (
          <Alert variant="warning" className="text-center">
            <h5>No groups found</h5>
            <p>Try adjusting your search terms or filters.</p>
          </Alert>
        )}

        {/* Rename Modal */}
        <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Rename Group</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>New Name</Form.Label>
                <Form.Control
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRenameModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveRename}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
  );
};

export default CustomerCart;
