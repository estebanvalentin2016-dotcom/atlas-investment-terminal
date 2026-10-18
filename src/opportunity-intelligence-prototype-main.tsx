import React from 'react';
import ReactDOM from 'react-dom/client';
import OpportunityIntelligencePrototype from './OpportunityIntelligencePrototype';

const root = document.getElementById('opportunity-intelligence-prototype');

if (!root) throw new Error('Opportunity Intelligence prototype root was not found.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OpportunityIntelligencePrototype />
  </React.StrictMode>,
);
