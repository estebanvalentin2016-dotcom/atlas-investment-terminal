import React from 'react';
import ReactDOM from 'react-dom/client';
import CompanyResearchPrototype from './CompanyResearchPrototype';

const root = document.getElementById('company-research-prototype');
if (!root) throw new Error('Company Research prototype root was not found.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <CompanyResearchPrototype />
  </React.StrictMode>,
);
