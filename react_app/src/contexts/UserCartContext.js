import axios from 'axios';
import Cookie from 'js-cookie';
import React, { useState, useEffect, createContext } from 'react';

export const UserCartContext = createContext();

const UserCartContextProvider = (props) => {
  const [cartGroups, setCartGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const getCartGroups = async (backendUrl) => {
    try {
      setLoading(true);
      const response = await axios.get(`${backendUrl}/api/auth/cart/`, {
        withCredentials: true,
      });
      setCartGroups(response.data);
      console.log('Cart groups loaded:', response.data);
    } catch (error) {
      console.error('Error loading cart groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (colonyIds, filterParams, groupName, backendUrl) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/cart/`,
        {
          colony_ids: colonyIds,
          filter_params: filterParams,
          name: groupName
        },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': Cookie.get('csrftoken'),
          },
        }
      );
      
      // Refresh cart groups after adding
      await getCartGroups(backendUrl);
      return response;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const deleteCartGroup = async (groupId, backendUrl) => {
    try {
      await axios.delete(
        `${backendUrl}/api/auth/cart/`,
        {
          data: { group_id: groupId },
          withCredentials: true,
          headers: {
            'X-CSRFToken': Cookie.get('csrftoken'),
          },
        }
      );
      
      // Refresh cart groups after deletion
      await getCartGroups(backendUrl);
    } catch (error) {
      console.error('Error deleting cart group:', error);
      throw error;
    }
  };

  const renameCartGroup = async (groupId, newName, backendUrl) => {
    try {
      await axios.put(
        `${backendUrl}/api/auth/cart/group/${groupId}/`,
        { name: newName },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': Cookie.get('csrftoken'),
          },
        }
      );
      
      // Update local state
      setCartGroups(prev => prev.map(group => 
        group.id === groupId ? { ...group, name: newName } : group
      ));
    } catch (error) {
      console.error('Error renaming cart group:', error);
      throw error;
    }
  };

  const exportCartGroups = async (groupIds, exportAll, backendUrl) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/cart/export/`,
        {
          group_ids: groupIds,
          export_all: exportAll
        },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': Cookie.get('csrftoken'),
          },
          responseType: 'blob', // Important for file download
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'coral_cart_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting cart:', error);
      throw error;
    }
  };

  useEffect(() => {
    getCartGroups(process.env.REACT_APP_BACKEND_URL);
  }, []);

  return (
    <UserCartContext.Provider value={{ 
      cartGroups, 
      loading,
      addToCart, 
      deleteCartGroup,
      renameCartGroup,
      exportCartGroups,
      refreshCart: () => getCartGroups(process.env.REACT_APP_BACKEND_URL)
    }}>
      {props.children}
    </UserCartContext.Provider>
  );
};

export default UserCartContextProvider;
