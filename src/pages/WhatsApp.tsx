import { useState, useMemo } from 'react';
import {
  Search,
  Phone,
  ExternalLink,
  Send,
  Paperclip,
  Smile,
  CheckCheck,
  MessageCircle,
  ClipboardList,
  Bell,
  Clock,
} from 'lucide-react';
import { whatsappConversations, type WhatsAppConversation } from '../data/mockData';

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500',
  Warm: 'bg-amber-500',
  Cold: 'bg-sky-500',
};

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-500',
  typing: 'bg-emerald-500',
};

// Add follow-up status to some conversations
const conversationsWithFollowUp = whatsappConversations.map((conv, index) => ({
  ...conv,
  needsFollowUp: index === 2 || index === 4 || index === 7, // Zanele, Naledi, Lerato
  followUpTime: index === 2 ? 'Today 2:00 PM' : index === 4 ? 'Tomorrow' : index === 7 ? 'Next Week' : null,
}));

export function WhatsApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<typeof conversationsWithFollowUp[0] | null>(
    conversationsWithFollowUp[0]
  );
  const [messageInput, setMessageInput] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversationsWithFollowUp;
    const query = searchQuery.toLowerCase();
    return conversationsWithFollowUp.filter(
      (c) =>
        c.contactName.toLowerCase().includes(query) ||
        c.phoneNumber.toLowerCase().includes(query) ||
        c.lastMessage.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const totalUnread = conversationsWithFollowUp.reduce((sum, c) => sum + c.unreadCount, 0);
  const totalFollowUps = conversationsWithFollowUp.filter(c => c.needsFollowUp).length;

  const handleOpenWhatsApp = () => {
    if (selectedConversation) {
      const phone = selectedConversation.phoneNumber.replace(/\s/g, '').replace('+', '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  };

  return (
    <div className="h-[calc(100vh-56px-48px)] flex rounded-xl overflow-hidden border border-slate-700 bg-slate-800/30">
      {/* Conversation List - Left Panel */}
      <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-800/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              WhatsApp
            </h2>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="text-xs font-medium bg-green-500 text-white px-2 py-0.5 rounded-full">
                  {totalUnread} new
                </span>
              )}
              {totalFollowUps > 0 && (
                <span className="text-xs font-medium bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {totalFollowUps} follow-up
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-slate-700/50 ${
                selectedConversation?.id === conversation.id
                  ? 'bg-slate-700/50'
                  : 'hover:bg-slate-700/30'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                  {conversation.contactName.split(' ').map(n => n[0]).join('')}
                </div>
                {/* Online indicator */}
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${statusColors[conversation.status]}`} />
                {/* Temperature indicator */}
                <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${temperatureColors[conversation.leadTemperature]}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white truncate">{conversation.contactName}</p>
                  <span className={`text-xs ${conversation.unreadCount > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                    {conversation.lastMessageTime}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{conversation.phoneNumber}</p>
                <p className="text-xs text-slate-400 truncate mt-1">{conversation.lastMessage}</p>

                {/* Badges */}
                <div className="flex items-center gap-2 mt-2">
                  {conversation.unreadCount > 0 && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      {conversation.unreadCount} unread
                    </span>
                  )}
                  {conversation.needsFollowUp && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Follow-up
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No conversations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat View - Right Panel */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-slate-900/50">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                    {selectedConversation.contactName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${statusColors[selectedConversation.status]}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedConversation.contactName}</p>
                  <p className="text-xs text-slate-400">{selectedConversation.phoneNumber}</p>
                </div>
                {selectedConversation.needsFollowUp && (
                  <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedConversation.followUpTime}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden xl:inline">Log Activity</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  <span className="hidden xl:inline">Add Follow-up</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden xl:inline">Open in WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 text-xs text-slate-500 bg-slate-800 rounded-full">Today</span>
            </div>

            {selectedConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-green-600 text-white rounded-br-md'
                      : 'bg-slate-700 text-slate-200 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${
                    message.sender === 'user' ? 'text-green-200' : 'text-slate-400'
                  }`}>
                    <span className="text-xs">{message.timestamp}</span>
                    {message.sender === 'user' && (
                      <CheckCheck className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <Smile className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-full text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 placeholder:text-slate-500"
              />
              <button
                type="button"
                className="p-2.5 rounded-full bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
              <span className="text-xs text-slate-500">Quick:</span>
              <button type="button" className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors">
                Send catalog
              </button>
              <button type="button" className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors">
                Schedule meeting
              </button>
              <button type="button" className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full transition-colors">
                Follow up
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-900/30">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Select a conversation to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
