import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Box component="main" sx={{ flex: 1, pt: { xs: 7, sm: 8 } }}>
        <Routes>
          {/* Home Route */}
          <Route path="/" element={
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <h1>🚀 JobsRo Platform</h1>
              <p>Welcome to JobsRo - Your Complete Job Portal Solution</p>
              <p>Backend API: Connected and Running</p>
              <p>Frontend: Successfully Deployed</p>
            </Box>
          } />

          {/* 404 Route */}
          <Route path="*" element={
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </Box>
          } />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;