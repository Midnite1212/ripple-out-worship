import { Button, Stack } from '@mui/material';
import { MOBILE_ACTION_BUTTONS_HEIGHT } from '../../constants';

type SetlistEditorMobileActionButtonsProps = {
  onCancel: () => void;
  isSubmitting: boolean;
};

const SetlistEditorMobileActionButtons = ({
  onCancel,
  isSubmitting,
}: SetlistEditorMobileActionButtonsProps) => (
  <Stack
    direction="row"
    spacing={2}
    width={'100%'}
    maxWidth={'100%'}
    paddingX={'1rem'}
    height={MOBILE_ACTION_BUTTONS_HEIGHT}
    maxHeight={MOBILE_ACTION_BUTTONS_HEIGHT}
  >
    <Button
      sx={{
        width: '50%',
        color: 'secondary.main',
        border: (theme) => `1px solid ${theme.palette.outline.main}`,
        borderRadius: '40px',
        textTransform: 'none',
      }}
      onClick={onCancel}
    >
      Cancel
    </Button>
    <Button
      type="submit"
      disabled={isSubmitting}
      sx={{
        width: '50%',
        backgroundColor: 'secondary.main',
        color: 'onPrimary.main',
        borderRadius: '40px',
        textTransform: 'none',
      }}
    >
      Save
    </Button>
  </Stack>
);

export default SetlistEditorMobileActionButtons;
