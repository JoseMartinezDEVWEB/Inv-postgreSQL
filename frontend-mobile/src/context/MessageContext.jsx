import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MessageContext = createContext();

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage debe usarse dentro de un MessageProvider');
  }
  return context;
};

const { width } = Dimensions.get('window');

export const MessageProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({
    title: '',
    message: '',
    type: 'info', // success, error, warning, info
    duration: 6000,
    onClose: null,
  });
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const showMessage = useCallback(({ message, description, type = 'info', duration = 6000, onClose }) => {
    // Limpiar timeout anterior si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setConfig({
      title: type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : type === 'warning' ? 'Advertencia' : 'Información',
      message: description ? `${message}\n${description}` : message,
      type,
      duration,
      onClose,
    });
    setVisible(true);

    // Animación de entrada
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto cierre
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        hideMessage();
      }, duration);
    }
  }, []);

  const hideMessage = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      if (config.onClose) config.onClose();
    });
  }, [config]);

  const getIconName = (type) => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      default: return 'information-circle';
    }
  };

  const getColors = (type) => {
    switch (type) {
      case 'success': return { bg: '#dcfce7', text: '#166534', icon: '#22c55e' };
      case 'error': return { bg: '#fee2e2', text: '#991b1b', icon: '#ef4444' };
      case 'warning': return { bg: '#fef9c3', text: '#854d0e', icon: '#eab308' };
      default: return { bg: '#e0f2fe', text: '#075985', icon: '#3b82f6' };
    }
  };

  const colors = getColors(config.type);

  return (
    <MessageContext.Provider value={{ showMessage, hideMessage }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={hideMessage}
      >
        <View style={styles.overlay}>
          <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: 'white' }]}>
            <View style={[styles.header, { backgroundColor: colors.bg }]}>
              <Ionicons name={getIconName(config.type)} size={28} color={colors.icon} />
              <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
              <TouchableOpacity onPress={hideMessage} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.content}>
              <Text style={styles.messageText}>{config.message}</Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.icon }]} 
                onPress={hideMessage}
              >
                <Text style={styles.buttonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </MessageContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width * 0.85,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 16,
    paddingTop: 0,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});





