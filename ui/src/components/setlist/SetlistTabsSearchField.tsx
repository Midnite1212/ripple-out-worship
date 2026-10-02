import { Dispatch, SetStateAction } from 'react';
import { TextField } from '@mui/material';

type SetlistTabsSearchFieldProps = {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
};

const SetlistTabsSearchField = ({ searchTerm, setSearchTerm }: SetlistTabsSearchFieldProps) => {
  return (
    <TextField
      variant="standard"
      placeholder="Search"
      InputProps={{
        sx: {
          fontSize: '1rem',
          color: 'onSurface.variant',
          background: (theme) => theme.palette.secondary.lighter,
          borderRadius: '26px',
          border: 0,
          padding: '0.5rem 1rem',
          marginRight: ' 0.5em',
          marginTop: '1em',
        },
        disableUnderline: true,
      }}
      sx={{
        width: '100%',
      }}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};

export default SetlistTabsSearchField;
