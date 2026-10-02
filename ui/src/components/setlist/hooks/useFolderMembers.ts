import { useCallback, useEffect, useMemo, useState } from 'react';
import { customAxios as axios } from '../../custom/customAxios';
import { GroupOwnership, Ownership } from '../../../types/ownership.types';
import { logRequestError } from '../../../helpers/global';

export type OwnershipRecord = Ownership & { _id: string };

type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info';

type UseFolderMembersParams = {
  mode: 'edit' | 'create';
  openDrawer: boolean;
  folderId?: string;
  folderName?: string;
  folderCreated?: string;
  ownership: Ownership;
  showSnackbar: (message: string, severity?: SnackbarSeverity) => void;
};

const addGroupToMember = async (member: OwnershipRecord | undefined, group: GroupOwnership) => {
  if (!member || member.groupIds?.some(({ id }) => id === group.id)) return null;
  const { data, status } = await axios.put('/api/ownerships/update', {
    _id: member._id,
    userId: member.userId,
    groupIds: [...(member.groupIds ?? []), group],
  });
  return status === 200 ? data : null;
};

const useFolderMembers = ({
  mode,
  openDrawer,
  folderId,
  folderName,
  folderCreated,
  ownership,
  showSnackbar,
}: UseFolderMembersParams) => {
  const [allPeople, setAllPeople] = useState<OwnershipRecord[]>([]);
  const [addedPeople, setAddedPeople] = useState<string[]>([]);
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openRemoveModal, setOpenRemoveModal] = useState<boolean>(false);
  const [personToRemove, setPersonToRemove] = useState<Ownership | null>(null);
  const [searchString, setSearchString] = useState('');
  const [filteredPeople, setFilteredPeople] = useState<OwnershipRecord[]>([]);

  useEffect(() => {
    if (mode === 'create' && ownership?.userId) {
      setAddedPeople([ownership.userId]);
    }
  }, [mode, ownership, openDrawer]);

  const addedPeopleList = useMemo(() => {
    return allPeople.filter((person) => addedPeople.includes(person.userId));
  }, [allPeople, addedPeople]);

  const getPeople = useCallback(async () => {
    try {
      const { data, status } = await axios.get<OwnershipRecord[]>('/api/ownerships/get');
      if (status === 200) {
        setAllPeople(data);
        if (mode !== 'create') {
          const existingMembers = data.filter(
            (person) => person.groupIds?.some((group) => group.id === folderId)
          );
          setAddedPeople(existingMembers.map((person) => person.userId));
        }
      }
    } catch (error) {
      showSnackbar('Failed to load users', 'error');
      logRequestError('Error fetching users:', error);
    }
  }, [folderId, mode, showSnackbar]);

  const addMembersToGroup = useCallback(
    (group: GroupOwnership) =>
      Promise.all(
        addedPeople.map((userId) =>
          addGroupToMember(
            allPeople.find((person) => person.userId === userId),
            group
          )
        )
      ),
    [addedPeople, allPeople]
  );

  const handleSaveMembers = useCallback(async () => {
    if (!folderId || !addedPeople.length) {
      return;
    }
    try {
      const currentGroup: GroupOwnership = {
        id: folderId,
        name: folderName ?? '',
        createdAt: folderCreated ?? Date.now().toString(),
      };
      await addMembersToGroup(currentGroup);
      showSnackbar('Members successfully added to folder!');
      getPeople();
    } catch (error) {
      showSnackbar('Failed to add members to folder', 'error');
      logRequestError('Error saving members:', error);
    }
  }, [
    addMembersToGroup,
    addedPeople,
    folderCreated,
    folderId,
    folderName,
    getPeople,
    showSnackbar,
  ]);

  const filterKeyword = useMemo(() => searchString.trim().toLowerCase(), [searchString]);
  const memoizedFilteredPeople = useMemo(() => {
    if (allPeople.length === 0) return [];
    if (filterKeyword.length < 2) return allPeople;

    return allPeople.filter((people) => {
      const personName = people.fullName.toLowerCase();
      return personName.includes(filterKeyword);
    });
  }, [filterKeyword, allPeople]);

  useEffect(() => {
    setFilteredPeople(memoizedFilteredPeople);
  }, [memoizedFilteredPeople]);

  const handleRemovePerson = useCallback(
    async (id: string) => {
      if (!folderId) {
        setAddedPeople((prev) => prev.filter((add) => add !== id));
        return;
      }
      try {
        const personToRemove = allPeople.find((person) => person.userId === id);
        const { data, status } = await axios.get<OwnershipRecord>('/api/ownerships/get', {
          params: {
            userId: id,
          },
        });
        if (status === 200 && data?._id) {
          await axios.put('/api/ownerships/update', {
            _id: data._id,
            userId: data.userId,
            groupIds: (data.groupIds ?? []).filter((group) => group.id !== folderId),
          });
          setAddedPeople((prev) => prev.filter((add) => add !== id));
          setAllPeople((prev) =>
            prev.map((person) =>
              person.userId === id
                ? {
                    ...person,
                    groupIds: (person.groupIds ?? []).filter((group) => group.id !== folderId),
                  }
                : person
            )
          );
          showSnackbar(`${personToRemove?.fullName || 'Member'} removed from folder`);
        }
      } catch (error) {
        showSnackbar('Failed to remove member from folder', 'error');
        logRequestError('Error removing person:', error);
      }
    },
    [folderId, allPeople, showSnackbar]
  );

  const handleAddPerson = useCallback(
    (id: string) => {
      const person = allPeople.find((p) => p.userId === id);
      const isSavedMember =
        !!folderId && !!person?.groupIds?.some(({ id: groupId }) => groupId === folderId);
      if (person && isSavedMember) {
        setPersonToRemove(person);
        setOpenRemoveModal(true);
        return;
      }
      setAddedPeople((prev) =>
        prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
      );
    },
    [allPeople, folderId]
  );

  const handleOpenRemoveModal = useCallback((person: Ownership) => {
    setPersonToRemove(person);
    setOpenRemoveModal(true);
  }, []);

  const handleCloseRemoveModal = useCallback(() => {
    setOpenRemoveModal(false);
    setPersonToRemove(null);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (personToRemove) {
      handleRemovePerson(personToRemove.userId);
    }
    handleCloseRemoveModal();
  }, [personToRemove, handleCloseRemoveModal, handleRemovePerson]);

  const handleOpenAddModal = useCallback(() => setOpenAddModal(true), []);

  const handleCloseAddModal = useCallback(() => {
    setOpenAddModal(false);
    handleSaveMembers();
    setSearchString('');
  }, [handleSaveMembers]);

  const resetMembers = useCallback(() => {
    setAddedPeople([]);
    setOpenAddModal(false);
    setOpenRemoveModal(false);
    setPersonToRemove(null);
  }, []);

  return {
    addedPeople,
    addedPeopleList,
    filteredPeople,
    openAddModal,
    openRemoveModal,
    personToRemove,
    searchString,
    setSearchString,
    getPeople,
    addMembersToGroup,
    handleAddPerson,
    handleOpenRemoveModal,
    handleCloseRemoveModal,
    handleConfirmRemove,
    handleOpenAddModal,
    handleCloseAddModal,
    resetMembers,
  };
};

export default useFolderMembers;
