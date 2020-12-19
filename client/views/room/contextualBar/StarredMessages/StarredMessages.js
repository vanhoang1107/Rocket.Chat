import React, { useEffect } from 'react';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';

import { useStarredMessages } from './hooks/useStarredMessages';
import { useTranslation } from '../../../../contexts/TranslationContext';
import { EmptyStarredMessages } from './components/EmptyStarredMessages';
import { StarredMessagesList } from './components/StarredMessagesList';
import VerticalBar from '../../../../components/VerticalBar';
import { useToastMessageDispatch } from '../../../../contexts/ToastMessagesContext';

export const StarredMessages = ({
	messages,
	handleClose, // TODO: prefer `onClose`; `handleClose` refers to the concrete implementation
}) => {
	const t = useTranslation();

	const content = Array.isArray(messages)
		? <StarredMessagesList messages={messages} />
		: <EmptyStarredMessages />;

	return <>
		<VerticalBar.Header>
			<VerticalBar.Icon name='star'/>
			<VerticalBar.Text>{ t('Starred_Messages') }</VerticalBar.Text>
			{handleClose && <VerticalBar.Close onClick={handleClose}/>}
		</VerticalBar.Header>
		<VerticalBar.ScrollableContent>
			{content}
		</VerticalBar.ScrollableContent>
	</>;
};

export default React.memo(({ tabBar, rid }) => {
	const handleClose = useMutableCallback(() => tabBar && tabBar.close());
	const { messages, error } = useStarredMessages(rid);

	const dispatchToastMessage = useToastMessageDispatch();
	useEffect(() => {
		if (error) {
			dispatchToastMessage({
				type: 'error',
				message: error,
			});
		}
	}, []);

	return <StarredMessages
		handleClose={handleClose}
		messages={messages}
	/>;
});