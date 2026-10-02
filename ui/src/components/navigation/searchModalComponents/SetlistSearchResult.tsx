import { Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { forwardRef } from 'react';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import SearchResultRow from './SearchResultRow';

type SetlistSearchResultProps = {
  _id: string;
  name: string;
  keyword: string;
  isFocused: boolean;
  onClose: () => void;
};

const SetlistSearchResult = forwardRef<HTMLDivElement, SetlistSearchResultProps>((props, ref?) => {
  const navigate = useNavigate();

  const { _id, name, keyword, isFocused, onClose } = props;

  const handleSelect = () => {
    if (keyword === '') {
      navigate('/setlist');
    } else {
      navigate(`/setlist/view/${_id}`);
    }
    onClose();
  };

  return (
    <SearchResultRow isFocused={isFocused} ref={ref} onClick={handleSelect}>
      <QueueMusicIcon />
      <Typography variant="body1">{keyword === '' ? 'Explore all setlists' : name}</Typography>
    </SearchResultRow>
  );
});

export default SetlistSearchResult;
