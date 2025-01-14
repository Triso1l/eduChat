// pages/chat/chat.js

Page({
	data: {
		messages: [
			// {
			// 	"sender": 'user',
			// 	"content": "hello world",
			// 	"type": "text"
			// }
		], // 聊天消息数组
		inputMessage: '', // 输入框内容
		scrollTop: 0, // 用于自动滚动到最新消息
		socketOpen: false, // WebSocket 连接状态
		socketTask: null, // WebSocket 任务
		pendingImages: [
			// {
			// 	'url': 'http://192.168.0.72:9000/uploads/1736866568_7SHwKEuETlcP2dc5428be3154375b6c78d2b16efcbc2.png',
			// 	'id': 1
			// },
			// {
			// 	'url': 'http://192.168.0.72:9000/uploads/1736866836_TbWNGftm2oLvc81f95f1583c9018b8a6b1d2eb8e35cb.png',
			// 	'id': 2
			// },
		] // 待发送的图片数组
	},

	onLoad() {
		this.initSocket();
	},

	onUnload() {
		this.closeSocket();
	},

	// 初始化 WebSocket 连接
	initSocket() {
		const that = this;
		const socketUrl = 'ws://192.168.0.72:9000/connect'; // 替换为您的 WebSocket 服务器地址，使用 wss://

		const socketTask = wx.connectSocket({
			url: socketUrl,
			success() {
				console.log('WebSocket 连接正在建立...')
			}
		});

		// 监听 WebSocket 打开
		socketTask.onOpen(() => {
			console.log('WebSocket 连接已打开')
			that.setData({
				socketOpen: true
			})
			that.addMessage("系统：连接已建立，可以开始聊天了。", "system", "text")
		});

		// 监听 WebSocket 接收消息
		socketTask.onMessage((res) => {
			console.log('收到服务器内容：', res.data)
			try {
				const message = JSON.parse(res.data)
				if (message.sender && message.content) {
					if (message.content == '<start>') {
						message.content = ''
						that.addMessage(message.content, message.sender, message.type, true)
					} else {
						that.addMessage(message.content, message.sender, message.type, false)
					}
				} else if (message.error) {
					wx.showToast({
						title: message.error,
						icon: 'none'
					})
				}
			} catch (e) {
				console.error('解析消息失败：', e)
			}
		});

		// 监听 WebSocket 错误
		socketTask.onError((err) => {
			console.error('WebSocket 连接失败：', err)
			wx.showToast({
				title: 'WebSocket 连接失败',
				icon: 'none'
			})
		});

		// 监听 WebSocket 关闭
		socketTask.onClose(() => {
			console.log('WebSocket 连接已关闭')
			that.setData({
				socketOpen: false
			})
			that.addMessage("系统：WebSocket 连接已关闭。", "system", "text")
			// 可选：尝试重连
			// setTimeout(that.initSocket, 500)
		});

		that.setData({
			socketTask
		})
	},

	// 关闭 WebSocket 连接
	closeSocket() {
		const { socketTask } = this.data
		if (socketTask) {
			socketTask.close()
		}
	},

	// 处理输入框内容变化
	handleInput(e) {
		this.setData({
			inputMessage: e.detail.value
		});
	},

	// 选择图片并上传
	chooseImage() {
		const that = this;
		wx.chooseImage({
			count: 1,
			sizeType: ['original', 'compressed'],
			sourceType: ['album', 'camera'],
			success(res) {
				const tempFilePaths = res.tempFilePaths;
				// 上传图片到服务器
				wx.uploadFile({
					url: 'http://192.168.0.72:9000/api/upload', // 替换为您的服务器上传接口，使用 https://
					filePath: tempFilePaths[0],
					name: 'image',
					success(uploadRes) {
						try {
							const data = JSON.parse(uploadRes.data);
							if (data.url) {
								// 将图片添加到待发送的图片数组
								const newPendingImage = {
									url: data.url,
									id: Date.now() // 唯一标识符，用于删除
								};
								that.setData({
									pendingImages: [...that.data.pendingImages, newPendingImage],
									scrollTop: that.data.messages.length * 1000 // 保持滚动位置
								});
							} else {
								wx.showToast({
									title: '上传失败',
									icon: 'none'
								});
							}
						} catch (e) {
							console.error('解析上传响应失败：', e);
							wx.showToast({
								title: '上传失败',
								icon: 'none'
							});
						}
					},
					fail() {
						wx.showToast({
							title: '上传失败',
							icon: 'none'
						});
					}
				});
			}
		});
	},

	// 发送消息按钮
	sendMessage() {
		const message = this.data.inputMessage.trim();
		const { pendingImages } = this.data;

		if (!message && pendingImages.length === 0) {
			wx.showToast({
				title: '请输入消息或选择图片',
				icon: 'none'
			});
			return;
		}

		// // 如果有待发送的图片，添加到聊天记录并发送
		if (pendingImages.length > 0) {
			pendingImages.forEach(image => {
				this.addMessage(image.url, "user", "image");
				// this.sendMessageToServer({
				// 	type: 'image',
				// 	content: image.url
				// });
			});
		}

		// // 如果有文本消息，添加到聊天记录并发送
		if (message) {
			this.addMessage(message, "user", "text");
			// this.sendMessageToServer({
			// 	type: 'text',
			// 	content: message
			// });
		}

		this.sendMessageToServer({
				type: 'text',
				content: this.data.messages
			});

		// 清空输入框和待发送的图片
		this.setData({
			inputMessage: '',
			pendingImages: []
		});
	},

	// 添加消息到聊天记录
	addMessage(content, sender, type = 'text', newAdd = true) {
		if (newAdd) {
			const newMessage = {
				sender,
				content,
				type
			};
			this.setData({
				messages: [...this.data.messages, newMessage],
				scrollTop: (this.data.messages.length + 1) * 1000 // 简单计算滚动位置
			});
		} else {
			const messages = this.data.messages
			const newMessage = messages[messages.length - 1]
			newMessage.content = newMessage.content + content
			messages[messages.length - 1] = newMessage
			this.setData({
				messages: messages,
				scrollTop: (this.data.messages.length + 1) * 2000 // 简单计算滚动位置
			});
		}
	},

	// 发送消息到服务器 via WebSocket
	sendMessageToServer(message) {
		const { socketOpen, socketTask } = this.data;
		if (socketOpen && socketTask) {
			const payload = JSON.stringify({
				message: message
			});
			socketTask.send({
				data: payload,
				success() {
					console.log('消息已发送：', message)
				},
				fail(err) {
					console.error('发送消息失败：', err)
					wx.showToast({
						title: '发送失败',
						icon: 'none'
					})
				}
			})
		} else {
			wx.showToast({
				title: 'WebSocket 未连接',
				icon: 'none'
			})
		}
	},

	// 删除待发送的图片
	removePendingImage(e) {
		const { id } = e.currentTarget.dataset;
		const updatedPendingImages = this.data.pendingImages.filter(img => img.id !== id);
		this.setData({
			pendingImages: updatedPendingImages
		});
	}
});