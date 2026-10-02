import { ReactNode, SyntheticEvent } from 'react';
import {
  Autocomplete,
  AutocompleteChangeDetails,
  AutocompleteChangeReason,
  AutocompleteRenderGetTagProps,
  TextField,
} from '@mui/material';
import { FieldValues, Path, UseFormRegister } from 'react-hook-form';

type AutocompleteInputRegistration<T extends FieldValues> =
  | { name: Path<T>; register: UseFormRegister<T> }
  | { name?: never; register?: never };

type AutocompleteInputProps<T extends FieldValues> = AutocompleteInputRegistration<T> & {
  id: string;
  options: string[];
  label: string;
  autoComplete: string;
  value: string | string[] | null;
  onChange: (
    event: SyntheticEvent<Element, Event>,
    value: string | string[] | null,
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<string> | undefined
  ) => void;
  renderTags?: (value: readonly string[], getTagProps: AutocompleteRenderGetTagProps) => ReactNode;
  freeSolo?: boolean;
  multiple?: boolean;
  getOptionDisabled?: (option: string) => boolean;
  helperText?: string;
  required?: boolean;
  clearAriaLabel?: string;
};

const AutocompleteInput = <T extends FieldValues>({
  id,
  name,
  options,
  label,
  autoComplete,
  value,
  onChange,
  register,
  renderTags,
  freeSolo,
  multiple,
  getOptionDisabled,
  helperText,
  required = false,
  clearAriaLabel = 'Clear all selected folders',
}: AutocompleteInputProps<T>) => {
  const registration = name && register ? register(name) : undefined;

  return (
    <Autocomplete
      multiple={multiple}
      freeSolo={freeSolo}
      id={id}
      options={options}
      getOptionLabel={(option) => option}
      getOptionDisabled={getOptionDisabled}
      filterSelectedOptions
      onChange={onChange}
      value={value}
      renderTags={renderTags}
      renderInput={(params) => (
        <>
          <TextField
            {...params}
            variant="outlined"
            label={label}
            helperText={helperText}
            {...registration}
            inputProps={{
              ...params.inputProps,
              autoComplete: autoComplete,
              required: required,
            }}
          />
        </>
      )}
      slotProps={{
        clearIndicator: {
          'aria-label': clearAriaLabel,
        },
      }}
    />
  );
};

export default AutocompleteInput;
