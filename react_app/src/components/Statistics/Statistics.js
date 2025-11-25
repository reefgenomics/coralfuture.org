import React, { useState, useEffect } from 'react';

const Statistics = () => {
  const [stats, setStats] = useState({
    coral_colonies: 0,
    research_projects: 0,
    countries: 0,
    data_access_24_7: false,
    observations_count: 0,
    species_count: 0,
    recent_observations: 0,
    top_countries: [],
    top_species: [],
    last_updated: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const backendUrl = '';
        const fullUrl = `${backendUrl}/api/public/statistics/`;
        
        console.log('Fetching statistics from:', fullUrl);
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError(err.message);
        // Fallback to default values if API fails
        setStats({
          coral_colonies: 0,
          research_projects: 0,
          countries: 0,
          data_access_24_7: false,
          observations_count: 0,
          species_count: 0,
          recent_observations: 0,
          top_countries: [],
          top_species: [],
          last_updated: ''
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  const formatNumber = (num) => {
    if (num >= 1000) {
      return `${Math.floor(num / 1000)}+`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="stats-section">
        <div className="container">
          <div className="row text-center g-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="col-md-3">
                <div className="stat-item">
                  <div className="stat-number">...</div>
                  <div className="stat-label">Loading...</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.warn('Statistics API error, using fallback values:', error);
    // You can add a visual indicator here if needed
  }

  return (
    <div className="stats-section">
      <div className="container">
        <div className="row text-center g-4">
          <div className="col-md-3">
            <div className="stat-item">
              <div className="stat-number">{formatNumber(stats.coral_colonies)}</div>
              <div className="stat-label">Coral Colonies</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="stat-item">
              <div className="stat-number">{formatNumber(stats.research_projects)}</div>
              <div className="stat-label">Research Projects</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="stat-item">
              <div className="stat-number">{formatNumber(stats.countries)}</div>
              <div className="stat-label">Countries</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="stat-item">
              <div className="stat-number">
                {stats.data_access_24_7 ? '24/7' : 'Limited'}
              </div>
              <div className="stat-label">Data Access</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
