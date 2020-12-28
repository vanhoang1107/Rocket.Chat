import { EJSON } from 'meteor/ejson';

import { logger } from './logger';


const crypto = require('crypto');

const firebase = require('firebase-admin');
const moment = require('moment');

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

	// Reference: https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages
	const payload = notification.payload ? { ejson: EJSON.stringify(notification.payload) } : {};
	const ttlSeconds = 3600;
	const message = {
		tokens: userTokens,
		data: payload,
	};

	const notiConf = {
		title: notification.title,
		body: notification.text,
	};
	const androidConf = {
		icon: '@drawable/ic_notification',
	};
	// Reference: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
	const apnsPayLoad = {
		alert: {
			title: notification.title,
			body: notification.text,
		},
		badge: notification.badge,
		category: notification.category,
		threadId: notification.from,
	};
	const apnsHeaders = {
		'apns-push-type': 'alert',
		'apns-topic': notification.topic,
		'apns-expiration': (moment().unix() + ttlSeconds).toString(),
		'apns-priority': (notification.priority || notification.priority === 0 ? notification.priority : 10).toString(),
		'apns-collapse-id': crypto.createHash('sha256').update(notification.from, 'utf8').digest('hex'), // 64 bytes limit
	};
	if (notification.image != null) {
		notiConf.image = notification.image;
	}
	if (notification.android_channel_id != null) {
		androidConf.channel_id = notification.android_channel_id;
	} else {
		logger.debug('For devices running Android 8.0 or later you are required to provide an android_channel_id. See https://github.com/raix/push/issues/341 for more info');
	}
	if (notification.sound != null) {
		androidConf.sound = notification.sound;
		apnsPayLoad.sound = notification.sound;
	}
	if (notification.contentAvailable != null) {
		apnsPayLoad.contentAvailable = notification.contentAvailable;
	}
	if (notification.notId != null) {
		apnsHeaders['apns-id'] = notification.notId;
	}
	message.notification = notiConf;
	message.android = {
		collapse_key: notification.from,
		priority: 'high',
		ttl: ttlSeconds * 1000,
		notification: androidConf,
	};
	message.apns = {
		headers: apnsHeaders,
		payload: Object.assign({ aps: apnsPayLoad }, payload),
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
