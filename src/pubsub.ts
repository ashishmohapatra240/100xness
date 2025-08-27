import Redis from 'ioredis';
import { REDIS_URL } from './lib/env';

export interface TradeMessage {
    type: string;
    data: any;
    timestamp: string;
}

const client = new Redis(REDIS_URL);

client.on('error', (err) => console.error('Redis Client Error', err));
const subscriber = client.duplicate();

subscriber.subscribe('market:trades', (err, count) => {
    if (err) {
        console.error('Error subscribing to channel', err);
    }
    console.log(`Subscribed to ${count} channels`);
});

subscriber.on('message', (channel, message) => {
    try {
        const tradeMessage: TradeMessage = JSON.parse(message);
        console.log(`Received ${tradeMessage.type} on channel ${channel}:`, {
            symbol: tradeMessage.data.s,
            price: tradeMessage.data.p,
            quantity: tradeMessage.data.q,
            timestamp: tradeMessage.timestamp
        });
    } catch (error) {
        console.error('Error parsing trade message:', error);
    }
});

// Export function for other parts of the application to subscribe to trades
export const subscribeToTrades = (callback: (trade: TradeMessage) => void) => {
    subscriber.on('message', (channel, message) => {
        if (channel === 'market:trades') {
            try {
                const tradeMessage: TradeMessage = JSON.parse(message);
                callback(tradeMessage);
            } catch (error) {
                console.error('Error parsing trade message in callback:', error);
            }
        }
    });
};

export default client;
