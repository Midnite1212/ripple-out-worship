import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const userSlice = createSlice({
  name: 'user',
  initialState: '' as string,
  reducers: {
    signin: (_, action: PayloadAction<string>) => {
      return action.payload;
    },
    signout: () => {
      return '';
    },
  },
});

export const { signin, signout } = userSlice.actions;

export default userSlice.reducer;
