import React from 'react'
import { Modal } from 'react-native'
import { useLoader } from '../context/LoaderContext'
import SplashScreen from './SplashScreen'

const LoaderPortal = () => {
  const { visible, durationMs, variant, message } = useLoader()
  return (
    <Modal 
      key={`loader-modal-${visible}`} 
      visible={visible} 
      animationType="fade" 
      transparent={true}
    >
      <SplashScreen onComplete={() => {}} durationMs={durationMs} variant={variant} message={message} />
    </Modal>
  )
}

export default LoaderPortal
