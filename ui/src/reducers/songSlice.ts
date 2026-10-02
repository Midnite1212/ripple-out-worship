import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SongSchema } from '../types/song.types';

export const songSlice = createSlice({
  name: 'songs',
  initialState: [] as SongSchema[],
  reducers: {
    fetchSongs: (_, action: PayloadAction<SongSchema[]>) => {
      return action.payload;
    },
  },
});

export const { fetchSongs } = songSlice.actions;

export default songSlice.reducer;
