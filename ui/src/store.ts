import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useSelector } from 'react-redux';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { ownershipSlice, songSlice, userSlice } from './reducers';
import { signout } from './reducers/userSlice';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['user'],
};

const appReducer = combineReducers({
  user: userSlice,
  songs: songSlice,
  ownership: ownershipSlice,
});

const rootReducer: typeof appReducer = (state, action) =>
  appReducer(signout.match(action) ? undefined : state, action);

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
