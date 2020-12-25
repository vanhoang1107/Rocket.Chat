import EJSON from 'meteor/ejson';
import moment from 'moment';

import logger from './logger';

const firebase = require('firebase-admin');

export const sendFCM = function({ userTokens, notification, _removeToken }) {
	// Make sure userTokens are an array of strings
	if (typeof userTokens === 'string') {
		userTokens = [userTokens];
	}

	// Check if any tokens in there to send
	if (!userTokens.length) {
		logger.debug('sendFCM no push tokens found');
		return;
	}

	logger.debug('sendFCM', userTokens, notification);

	const now = moment();

	// Reference: https://notifee.app/react-native/reference/notification
	const notifeeData = {
		id: notification.notId,
		title: notification.title,
		body: notification.text,
		android: {
			category: 'MESSAGE',
			channelId: notification.android_channel_id,
			groupId: notification.from,
			groupSummary: true,
			importance: 'HIGH',
			sound: notification.sound,
			style: { type: 'INBOX' },
			timestamp: now.milliseconds(),
			visibility: 'PRIVATE',
		},
		ios: {
			badgeCount: notification.badge,
			categoryId: notification.category,
			sound: notification.sound,
			threadId: notification.from,
		},
	};
	const message = {
		tokens: userTokens,
		notification: {
			title: notification.title,
			body: notification.text,
			image: notification.image,
		},
		data: {
			notifee: notifeeData,
			ejson: notification.payload ? EJSON.stringify(notification.payload) : null,
		},
		android: {
			ttl: '1h',
		},
		apns: {
			headers: {
				'apns-push-type': 'alert',
				'apns-id': notification.notId,
				'apns-expiration': moment.unix() + 3600,
				'apns-priority': notification.priority || notification.priority === 0 ? notification.priority : 10,
				'apns-collapse-id': crypto.createHash('sha256').update(notification.from, 'utf8').digest('hex'), // 64 bytes limit
			},
			payload: {
				aps: {
					'content-available': notification.contentAvailable,
				},
			},
		},
	};

	userTokens.forEach((value, idx) => logger.debug(`Send message to token ${ idx }: ${ value }`));

	firebase.messaging().sendMulticast(message)
		.then((response) => {
			response.responses.forEach((resp, idx) => {
				logger.debug(`sendFCM: Result of sender ${ idx }: ${ JSON.stringify(resp) }`);
				if (resp.success) {
					return;
				}

				const token = userTokens[idx];
				try {
					_removeToken({ gcm: token });
					_removeToken({ apn: token });
				} catch (err) {
					logger.error(`Error removing token ${ token }`, err);
				}
			});
		})
		.catch((error) => {
			logger.debug(`sendFCM: result of sender: ${ error }`);
		});
};
