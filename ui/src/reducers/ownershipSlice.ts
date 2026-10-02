import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { Ownership } from '../types/ownership.types';

const initialState: Ownership = {
  userId: '',
  fullName: '',
  accessType: '',
  groupIds: [],
  setlistIds: [],
  isDeleted: false,
};

export const ownershipSlice = createSlice({
  name: 'ownership',
  initialState,
  reducers: {
    fetchOwnership: (_, action: PayloadAction<Ownership>) => {
      return action.payload;
    },
  },
});

export const { fetchOwnership } = ownershipSlice.actions;

export default ownershipSlice.reducer;
