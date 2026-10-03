import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import GroupAdd from '@mui/icons-material/GroupAdd';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import SetlistFolderAddPersonListItem from './SetlistFolderAddPersonListItem';
import { Ownership } from '../../types/ownership.types';

type SetlistFolderAddPeopleDialogProps = {
  open: boolean;
  onClose: () => void;
  searchString: string;
  onSearchChange: (value: string) => void;
  filteredPeople: Ownership[];
  addedPeople: string[];
  onTogglePerson: (userId: string) => void;
};

const SetlistFolderAddPeopleDialog = ({
  open,
  onClose,
  searchString,
  onSearchChange,
  filteredPeople,
  addedPeople,
  onTogglePerson,
}: SetlistFolderAddPeopleDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: { width: '30rem', height: '30rem', borderRadius: '1.75rem', padding: '0.5rem' },
    }}
  >
    <DialogTitle
      display="flex"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <HeaderWithIcon
        Icon={GroupAdd}
        headerText="Add People"
        headerVariant="h3"
        iconColor="secondary.main"
      />
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{ color: (theme) => theme.palette.grey[500] }}
      >
        <Close />
      </IconButton>
    </DialogTitle>
    <InputBase
      placeholder="Search by name"
      sx={{
        alignSelf: 'center',
        width: '90%',
        px: '1.25rem',
        py: '0.75rem',
        color: 'secondary.light',
        backgroundColor: 'secondary.lighter',
        borderRadius: '1.75rem',
        fontWeight: 400,
        fontSize: '1rem',
      }}
      value={searchString}
      onChange={(e) => onSearchChange(e.target.value)}
      autoFocus
    />
    <DialogContent sx={{ pt: 0 }}>
      <List>
        {filteredPeople.length > 0 ? (
          filteredPeople.map((person) => (
            <SetlistFolderAddPersonListItem
              key={person.userId}
              person={person}
              isAdded={addedPeople.includes(person.userId)}
              onToggle={onTogglePerson}
            />
          ))
        ) : (
          <ListItem>
            <Typography variant="subtitle1" color="primary.lighter">
              No users found
            </Typography>
          </ListItem>
        )}
      </List>
    </DialogContent>
  </Dialog>
);

export default SetlistFolderAddPeopleDialog;
