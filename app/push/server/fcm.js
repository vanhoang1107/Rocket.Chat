import * as admin from 'firebase-admin';
import { EJSON } from 'meteor/ejson';
import { moment } from 'moment';

import { logger } from './logger';

export const sendFCM = function({ userTokens, notification, _removeToken, options }) {
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

	// Reference: https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages
	const payload = notification.payload ? { ejson: EJSON.stringify(notification.payload) } : {};
	const message = {
		tokens: userTokens,
		data: payload,
	};

	const notiConf = {
		title: notification.title,
		body: notification.text,
	};
	const androidConf = {
		collapse_key: notification.from,
		priority: 'HIGH',
		ttl: '1h',
	};
	// Reference: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
	const apnsConf = {
		alert: {
			title: notification.title,
			body: notification.text,
		},
		badge: notification.badge,
		category: notification.category,
	};
	if (notification.image != null) {
		notiConf.image = notification.image;
	}
	if (notification.android_channel_id != null) {
		androidConf.channel_id = notification.android_channel_id;
	} else {
		logger.debug('For devices running Android 8.0 or later you are required to provide an android_channel_id. See https://github.com/raix/push/issues/341 for more info');
	}
	if (notification.contentAvailable != null) {
		apnsConf['content-available'] = notification.contentAvailable;
	}
	if (notification.sound != null) {
		apnsConf.sound = notification.sound;
		message.sound = notification.sound;
	}
	message.notification = notiConf;
	message.android = androidConf;
	message.apns = {
		headers: {
			'apns-push-type': 'alert',
			'apns-id': notification.notId,
			'apns-expiration': moment.unix() + 3600,
			'apns-priority': notification.priority || notification.priority === 0 ? notification.priority : 10,
			'apns-collapse-id': crypto.createHash('sha256').update(notification.from, 'utf8').digest('hex'), // 64 bytes limit
		},
		payload: Object.assign(payload, { aps: apnsConf }),
	};

	userTokens.forEach((value, idx) => logger.debug(`Send message to token ${ idx }: ${ value }`));

	admin.messaging().sendMulticast(message)
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
