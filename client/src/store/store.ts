import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { jobSlice } from './slices/jobSlice';
import { uiSlice } from './slices/uiSlice';
import { profileSlice } from './slices/profileSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    jobs: jobSlice.reducer,
    ui: uiSlice.reducer,
    profile: profileSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;