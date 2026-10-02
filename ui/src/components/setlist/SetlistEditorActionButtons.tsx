import { Stack } from '@mui/material';
import { CancelButton, StyledButton } from './SetlistEditor.styles';

type SetlistEditorActionButtonsProps = {
  onCancel: () => void;
  isSubmitting: boolean;
};

const SetlistEditorActionButtons = ({
  onCancel,
  isSubmitting,
}: SetlistEditorActionButtonsProps) => (
  <Stack direction="row">
    <CancelButton color="secondary" onClick={onCancel}>
      Cancel
    </CancelButton>
    <StyledButton type="submit" color="secondary" variant="contained" disabled={isSubmitting}>
      Save
    </StyledButton>
  </Stack>
);

export default SetlistEditorActionButtons;
