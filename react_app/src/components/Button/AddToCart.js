import React, { useEffect, useState, useContext } from 'react';
import { Button, FormGroup, Alert, Row, Col, Modal, Form } from 'react-bootstrap';
// Internal imports
// Contexts
import { AuthContext } from 'contexts/AuthContext';
import { SidebarFilterContext } from 'contexts/SidebarFilterContext';
import { UserCartContext } from 'contexts/UserCartContext';

const AddToCartButton = () => {

  const { authData } = useContext(AuthContext);
  const { filteredColonies, filters } = useContext(SidebarFilterContext);
  const { addToCart } = useContext(UserCartContext);

  const [alertShow, setAlertShow] = useState(false);
  const [alertShowTime, setAlertShowTime] = useState(0);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Auto-generate group name based on filters
  useEffect(() => {
    if (filters && Object.keys(filters).length > 0) {
      const nameParts = [];
      
      if (filters.species && filters.species !== '') {
        nameParts.push(filters.species);
      }
      
      if (filters.project && filters.project !== '') {
        nameParts.push(filters.project);
      }
      
      if (filters.years && filters.years.length > 0) {
        nameParts.push(`Years: ${filters.years.join(', ')}`);
      }
      
      // Add temperature filter info if any are set
      const tempFilters = [];
      if (filters.absThermalTolerance && (filters.absThermalTolerance[0] !== 20 || filters.absThermalTolerance[1] !== 40)) {
        tempFilters.push(`TT: ${filters.absThermalTolerance[0]}-${filters.absThermalTolerance[1]}°C`);
      }
      if (filters.absBreakpointTemperature && (filters.absBreakpointTemperature[0] !== 20 || filters.absBreakpointTemperature[1] !== 40)) {
        tempFilters.push(`BT: ${filters.absBreakpointTemperature[0]}-${filters.absBreakpointTemperature[1]}°C`);
      }
      if (filters.absThermalLimit && (filters.absThermalLimit[0] !== 20 || filters.absThermalLimit[1] !== 40)) {
        tempFilters.push(`TL: ${filters.absThermalLimit[0]}-${filters.absThermalLimit[1]}°C`);
      }
      
      if (tempFilters.length > 0) {
        nameParts.push(tempFilters.join(', '));
      }
      
      if (nameParts.length > 0) {
        setGroupName(nameParts.join(' | '));
      } else {
        setGroupName('Filter Group');
      }
    } else {
      setGroupName('All Colonies');
    }
  }, [filters]);

  const handleAddToCart = async () => {
    if (!groupName.trim()) {
      setErrorOccurred(true);
      setAlertShow(true);
      return;
    }

    setAlertShow(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const coloniesIds = filteredColonies.map(colony => colony.id);
      
      // Add to cart with group name and filter params
      await addToCart(coloniesIds, filters, groupName, backendUrl);
      setErrorOccurred(false);
      setAlertShowTime(Date.now());
      setShowModal(false);
      setGroupName('');
    } catch (error) {
      console.error('Error adding colonies to cart:', error);
      setErrorOccurred(true);
    }
  };

  useEffect(() => {
    // Disappearing alert only for success
    if (authData.authenticated && !errorOccurred && alertShow) {
      const timer = setTimeout(() => {
        setAlertShow(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [alertShow, alertShowTime, authData.authenticated, errorOccurred]);

  return (
    <div>
      <Row className="mb-3">
        <Col>
          <FormGroup className="mb-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowModal(true)}
              style={{ width: '100%' }}
            >
              <i className="bi bi-cart4"></i> Add to cart
            </Button>
          </FormGroup>
        </Col>
      </Row>
      <Row className="mb-3">
        <Col>
          {authData.authenticated && !errorOccurred && alertShow && (
            // If respond to add data is good send success if bad, display variant error
            <Alert variant='success'>
              Item added to cart!
            </Alert>
          )}
          {authData.authenticated && errorOccurred && alertShow && (
            <Alert variant='danger'>
              An error occurred while adding to cart
            </Alert>
          )}
          {!authData.authenticated && errorOccurred && alertShow && (
            <Alert variant='warning'>
              Login to add data to cart
            </Alert>
          )}

        </Col>
      </Row>

      {/* Modal for group name input */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add to Cart</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Group Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter a name for this filter group"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
              <Form.Text className="text-muted">
                The name is auto-generated based on your filters. You can edit it if needed.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddToCart}>
            Add to Cart
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AddToCartButton;
