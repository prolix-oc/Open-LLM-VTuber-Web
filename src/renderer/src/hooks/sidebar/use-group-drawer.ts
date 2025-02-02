import { useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { toaster } from '@/components/ui/toaster';

export const useGroupDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteUid, setInviteUid] = useState('');
  const { sendMessage } = useWebSocket();

  const handleInvite = () => {
    if (!inviteUid.trim()) {
      toaster.create({
        title: 'Please enter a valid UUID',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    sendMessage({
      type: 'add-client-to-group',
      invitee_uid: inviteUid.trim(),
    });
    setInviteUid('');
  };

  const handleRemove = (targetUid: string) => {
    sendMessage({
      type: 'remove-client-from-group',
      target_uid: targetUid,
    });
  };

  const handleLeaveGroup = (selfUid: string) => {
    sendMessage({
      type: 'remove-client-from-group',
      target_uid: selfUid,
    });
  };

  return {
    isOpen,
    setIsOpen,
    inviteUid,
    setInviteUid,
    handleInvite,
    handleRemove,
    handleLeaveGroup,
  };
};
