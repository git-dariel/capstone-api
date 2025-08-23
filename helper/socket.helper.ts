import { Server } from "socket.io";

export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
	const room = `user_${userId}`;
	console.log(`Emitting '${event}' to room: ${room}`, {
		userId,
		event,
		messageId: data?.message?.id,
		messageContent: data?.message?.content?.substring(0, 50),
	});

	// Get the rooms and connected sockets for debugging
	const roomSockets = io.sockets.adapter.rooms.get(room);
	console.log(`Room ${room} has ${roomSockets?.size || 0} connected sockets`);

	io.to(room).emit(event, data);
};

export const emitToUsers = (io: Server, userIds: string[], event: string, data: any) => {
	console.log(`Emitting '${event}' to multiple users:`, userIds);
	userIds.forEach((userId) => {
		emitToUser(io, userId, event, data);
	});
};
