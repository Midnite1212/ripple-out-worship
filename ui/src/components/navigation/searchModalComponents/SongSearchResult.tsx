import { Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { forwardRef } from 'react';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SearchResultRow from './SearchResultRow';

type SongSearchResultProps = {
  _id: string;
  title: string;
  keyword: string;
  isFocused: boolean;
  onClose: () => void;
};

const SongSearchResult = forwardRef<HTMLDivElement, SongSearchResultProps>((props, ref?) => {
  const navigate = useNavigate();

  const { _id, title, keyword, isFocused, onClose } = props;

  const handleSelect = () => {
    if (keyword === '') {
      navigate('/song');
    } else {
      navigate(`/song/${_id}`);
    }
    onClose();
  };

  return (
    <SearchResultRow isFocused={isFocused} ref={ref} onClick={handleSelect}>
      <MusicNoteIcon />
      <Typography variant="body1">{keyword === '' ? 'Explore all songs' : title}</Typography>
    </SearchResultRow>
  );
});

export default SongSearchResult;
