import { router } from 'expo-router';
import { use, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type MessageType = 'user' | 'step' | 'answer';

type ChatMessage = {
  id: string;
  text: string;
  type: MessageType;
};

const BUBBLE_COLORS: Record<MessageType, string> = {
  user: '#D9F99D',
  step: '#FDE68A',
  answer: '#BFDBFE',
};

const TEXT_COLORS: Record<MessageType, string> = {
  user: '#1A2E05',
  step: '#78350F',
  answer: '#172554',
};

type ReservationInfo = {
  id: string;
  guestName: string;
};

type ReservationsInfoResponse = {
  reservationInfo: ReservationInfo[];
};

type ErrorResponse = {
  error: string;
};


type allMessagesResponse = {
  conversationHistory: {
    id: string;
    reservationId: string | null;
    userMessage: string;
    detectedIntent: string | null;
    filter: boolean;
    needToRetrieveContext: boolean;
    retrievedContext: unknown;
    firstResponse: unknown;
    guardrailStatus: string | null;
    finalReply: unknown;
    createdAt: Date;
  }[]
};

async function buildAssistantFlow(id: string) {
  let allMessages: allMessagesResponse | ErrorResponse;
  try {
    // call api to retrieve all chat for this reservation id
    allMessages = await fetch(`http://localhost:3001/reservations/${id}/conversation`).then((res) => res.json());
  }
  catch (error) {
    return {
      steps: [],
      answer: 'Erreur lors de la récupération des messages.',
    };
  }
  // verif type of response (ErrorResponse or allMessagesResponse)
  if ('error' in allMessages) {
    alert(`Erreur lors de la récupération des messages: ${allMessages.error}`);
    return {
      steps: [],
      answer: 'Erreur lors de la récupération des messages.',
    };
  }
  const conversationHistory = allMessages.conversationHistory[0];

  // last message in conversation history, extract the userMessage, detectedIntent, filter, needToRetrieveContext, retrievedContext, firstResponse, guardrailStatus and finalReply and build a flow with it
  const steps: string[] = [];
  let answer = '';
  if (conversationHistory.userMessage) {
    steps.push(`Message de l'utilisateur: ${conversationHistory.userMessage}`);
  }
  if (conversationHistory.detectedIntent) {
    steps.push(`Intent détecté: ${conversationHistory.detectedIntent}`);
  }
  if (conversationHistory.filter) {
    steps.push('Filtre activé');
  }
  if (conversationHistory.needToRetrieveContext) {
    steps.push('Contexte requis');
    if (conversationHistory.retrievedContext) {
      steps.push(`Contexte récupéré: ${JSON.stringify(conversationHistory.retrievedContext)}`);
    }
  }
  if (conversationHistory.firstResponse) {
    steps.push(`Première réponse de l'assistant: ${JSON.stringify(conversationHistory.firstResponse)}`);
  }
  if (conversationHistory.guardrailStatus) {
    steps.push(`Statut des guardrails: ${conversationHistory.guardrailStatus}`);
  }
  if (conversationHistory.finalReply) {
    answer = `Réponse finale de l'assistant: ${JSON.stringify(conversationHistory.finalReply)}`;
  }

  return {
    steps,
    answer,
  };
}

export default function ChatScreen() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: 'Bienvenue. Ecris un message pour voir les etapes intermediaires puis la reponse finale.',
      type: 'answer',
    },
  ]);
  const scrollRef = useRef<ScrollView>(null);
  const timeoutIds = useRef<number[]>([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch("http://localhost:3001/reservations/info");
        const data: ReservationsInfoResponse | ErrorResponse = await response.json();

        if (!response.ok || "error" in data) {
          alert(
            "error" in data
              ? `Erreur lors de la récupération des réservations: ${data.error}`
              : "Erreur lors de la récupération des réservations"
          );
          router.replace("/");
        }
        else {
          setOptions(data.reservationInfo.map((info) => info.id));
        }
      } catch (error) {
        alert("Impossible de contacter le serveur");
        router.replace("/");
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    // load converssation history
    async function loadConversationHistory() {
      if (!selectedValue) {
        return;
      }
      try {
        const response = await fetch(`http://localhost:3001/reservations/${selectedValue}/conversation`);
        const data: allMessagesResponse | ErrorResponse = await response.json();

        if (!response.ok || "error" in data) {
          alert(
            "error" in data
              ? `Erreur lors de la récupération des messages: ${data.error}`
              : "Erreur lors de la récupération des messages"
          );
          return;
        }

        const conversationHistory = data.conversationHistory;
        const newMessages: ChatMessage[] = [];

        conversationHistory.forEach((message) => {
          newMessages.push({
            id: `user-${message.id}`,
            text: message.userMessage,
            type: 'user',
          });

          if (message.detectedIntent) {
            newMessages.push({
              id: `intent-${message.id}`,
              text: `Intent détecté: ${message.detectedIntent}`,
              type: 'step',
            });
          }

          if (message.filter) {
            newMessages.push({
              id: `filter-${message.id}`,
              text: 'Filtre activé',
              type: 'step',
            });
          }

          if (message.needToRetrieveContext) {
            newMessages.push({
              id: `need-context-${message.id}`,
              text: 'Contexte requis',
              type: 'step',
            });

            if (message.retrievedContext) {
              newMessages.push({
                id: `context-${message.id}`,
                text: `Contexte récupéré: ${JSON.stringify(message.retrievedContext)}`,
                type: 'step',
              });
            }
          }

          if (message.firstResponse) {
            newMessages.push({
              id: `first-${message.id}`,
              text: `Première réponse de l'assistant: ${JSON.stringify(message.firstResponse)}`,
              type: 'step',
            });
          }

          if (message.guardrailStatus) {
            newMessages.push({
              id: `guardrail-${message.id}`,
              text: `Statut des guardrails: ${message.guardrailStatus}`,
              type: 'step',
            });
          }

          if (message.finalReply) {
            newMessages.push({
              id: `final-${message.id}`,
              text: `Réponse finale de l'assistant: ${JSON.stringify(message.finalReply)}`,
              type: 'answer',
            });
          }
        });

        setMessages(
          newMessages.length > 0
            ? newMessages
            : [
              {
                id: `empty-${selectedValue}`,
                text: "Aucun message pour cette réservation.",
                type: "answer",
              },
            ]
        );

      } catch (error) {
        alert("Impossible de contacter le serveur");
      }
    }
    loadConversationHistory();
  }, [selectedValue]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  function pushMessage(message: ChatMessage) {
    setMessages((currentMessages) => [...currentMessages, message]);
  }

  function scheduleMessage(delay: number, message: ChatMessage) {
    const timeoutId = setTimeout(() => {
      pushMessage(message);
    }, delay);

    timeoutIds.current.push(timeoutId);
  }

  async function handleSend() {
    const trimmedInput = input.trim();

    if (!selectedValue) {
      alert('Veuillez sélectionner une réservation avant d envoyer un message');
      return;
    }

    if (!trimmedInput) {
      alert('Le message est vide');
      return;
    }

    if (isSending) {
      return;
    }

    const sentAt = Date.now();
    const loadingMessageId = `loading-${sentAt}`;
    let shouldResetSendingNow = true;

    setIsSending(true);
    pushMessage({
      id: `user-${sentAt}`,
      text: trimmedInput,
      type: 'user',
    });
    pushMessage({
      id: loadingMessageId,
      text: 'Chargement...',
      type: 'step',
    });
    setInput('');

    try {
      const response = await fetch("http://localhost:3001/rag/newMessage", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedInput, reservationId: selectedValue }),
      });
      const data: { error?: string; errorGeneral?: string } | { reply: string; reservationId: string } = await response.json();

      if (!response.ok || "error" in data || "errorGeneral" in data) {
        setMessages((currentMessages) =>
          currentMessages.filter((message) => message.id !== loadingMessageId)
        );
        const errorMessage =
          ("error" in data && data.error) ||
          ("errorGeneral" in data && data.errorGeneral) ||
          "Erreur lors de l'envoi du message";
        alert(errorMessage);
        return;
      }

      const flow = await buildAssistantFlow(selectedValue);
      shouldResetSendingNow = false;

      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== loadingMessageId)
      );

      flow.steps.forEach((step, index) => {
        scheduleMessage(500 * (index + 1), {
          id: `step-${sentAt}-${index}`,
          text: step,
          type: 'step',
        });
      });

      const finalDelay = 500 * flow.steps.length + 700;

      const timeoutId = setTimeout(() => {
        pushMessage({
          id: `answer-${sentAt}`,
          text: flow.answer,
          type: 'answer',
        });
        setIsSending(false);
      }, finalDelay);

      timeoutIds.current.push(timeoutId);
    } catch (error: unknown) {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== loadingMessageId)
      );
      alert("Impossible de contacter le serveur");
      return;
    } finally {
      if (shouldResetSendingNow) {
        setIsSending(false);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>Une couleur par type de message.</Text>
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendText}>Vert = toi</Text>
          <Text style={styles.legendText}>Jaune = etapes</Text>
          <Text style={styles.legendText}>Bleu = reponse finale</Text>
        </View>

        <View style={styles.selectWrapper}>
          <Text style={styles.selectLabel}>Reservation</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => setIsOpen((value) => !value)}>
            <Text
              style={[
                styles.selectButtonText,
                !selectedValue && styles.selectPlaceholder,
              ]}>
              {selectedValue ?? 'Choisir une reservation'}
            </Text>
            <Text style={styles.selectChevron}>{isOpen ? '▲' : '▼'}</Text>
          </Pressable>

          {isOpen && (
            <ScrollView style={styles.selectMenu} nestedScrollEnabled>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.selectOption,
                    selectedValue === option && styles.selectOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedValue(option);
                    setIsOpen(false);
                  }}>
                  <Text style={styles.selectOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>


        <ScrollView
          ref={scrollRef}
          style={styles.messagesWrapper}
          contentContainerStyle={styles.messagesContent}>
          {messages.map((message) => {
            const isUser = message.type === 'user';

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userRow : styles.assistantRow,
                ]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: BUBBLE_COLORS[message.type],
                    },
                  ]}>
                  <Text style={styles.messageLabel}>
                    {message.type === 'user'
                      ? 'Toi'
                      : message.type === 'step'
                        ? 'Etape'
                        : 'Reponse'}
                  </Text>
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color: TEXT_COLORS[message.type],
                      },
                    ]}>
                    {message.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ecris ton message..."
            placeholderTextColor="#6B7280"
            style={styles.input}
            editable={!isSending}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isSending}>
            <Text style={styles.sendButtonText}>{isSending ? '...' : 'Envoyer'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectWrapper: {
    gap: 8,
    zIndex: 10,
    alignSelf: 'flex-start',
  },
  selectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  selectButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 220,
    maxWidth: 260,
  },
  selectButtonText: {
    fontSize: 15,
    color: '#0F172A',
  },
  selectPlaceholder: {
    color: '#64748B',
  },
  selectChevron: {
    fontSize: 12,
    color: '#475569',
  },
  selectMenu: {
    maxHeight: 180,
    minWidth: 220,
    maxWidth: 260,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectOptionSelected: {
    backgroundColor: '#E0F2FE',
  },
  selectOptionText: {
    fontSize: 15,
    color: '#0F172A',
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContent: {
    gap: 10,
    paddingVertical: 8,
  },
  messageRow: {
    width: '100%',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#475569',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  sendButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
