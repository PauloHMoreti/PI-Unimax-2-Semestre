import React, { useState, useEffect, useRef, ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import mqtt, { MqttClient } from "mqtt";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Configurações do Cliente MQTT ---
const brokerHost = "broker.hivemq.com";
const brokerPort = 8000; // Porta para WebSockets 8000 = Padrão 1883 = Configurado no ESP
const mqttTopic = "hivemq/test"; // O MESMO tópico do seu ESP! meu/esp32/sensordata
const clientID = `mobileClient_${Math.random().toString(16)}`;
const connectionUrl = `ws://${brokerHost}:${brokerPort}/mqtt`;

// --- Definições de Tipos (TypeScript) ---

// Define o formato esperado da mensagem JSON do seu sensor
interface IncomingSensorData {
  lat: number;
  lng: number;
  distancia: number;
  ppm: number;
}

// Define o tipo do nosso objeto de estado para os dados dos sensores
interface SensorDataState {
  lat: string | number;
  lng: string | number;
  distancia: string | number;
  ppm: string | number;
}

// Define os possíveis status da conexão para termos autocompletar e segurança
type ConnectionStatus =
  | "Conectando..."
  | "Conectado"
  | "Desconectado"
  | "Erro de Conexão"
  | "Falha na Inscrição";

// --- Componentes Reutilizáveis Tipados ---

interface SensorCardProps {
  title: string;
  children: ReactNode; // ReactNode permite passar qualquer elemento React como filho
}

const SensorCard: React.FC<SensorCardProps> = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

interface DataDisplayProps {
  value: string | number;
  unit: string;
  label?: string; // A interrogação torna a propriedade opcional
}

const DataDisplay: React.FC<DataDisplayProps> = ({ value, unit, label }) => (
  <View style={styles.dataContainer}>
    {label && <Text style={styles.dataLabel}>{label}</Text>}
    <Text style={styles.dataValue}>
      {value} <Text style={styles.dataUnit}>{unit}</Text>
    </Text>
  </View>
);

// --- Componente Principal da Aplicação ---

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("Conectando...");
  const [sensorData, setSensorData] = useState<SensorDataState>({
    lat: "--",
    lng: "--",
    distancia: "--",
    ppm: "--",
  });

  // Tipamos a ref para conter ou um MqttClient ou null
  const clientRef = useRef<MqttClient | null>(null);
  const [Mockar, setMockar] = useState<boolean>(false);

  useEffect(() => {
    // Evita reconexões se o cliente já existir
    if (clientRef.current) return;

    // Se estiver em modo de mock, não conecta ao MQTT
    if (Mockar === false) {
      try {
        // Usamos a função 'connect' importada
        clientRef.current = mqtt.connect(connectionUrl, { clientId: clientID });
        const client = clientRef.current;

        client.on("connect", () => {
          console.log("Conectado ao broker MQTT!");
          setStatus("Conectado");
          client.subscribe(mqttTopic, (err) => {
            if (err) {
              console.error("Falha na inscrição do tópico:", err);
              setStatus("Falha na Inscrição");
            }
          });
        });

        client.on("error", (err) => {
          console.error("Erro de conexão:", err);
          setStatus("Erro de Conexão");
          client.end(true); // Força o fechamento
        });

        client.on("close", () => {
          console.log("Conexão perdida.");
          setStatus("Desconectado");
        });

        client.on("message", (topic, message) => {
          console.log(
            `Mensagem recebida no tópico ${topic}: ${message.toString()}`
          );
          try {
            // 'as' faz um type cast, dizendo ao TS para confiar no formato do dado
            const data = JSON.parse(message.toString()) as IncomingSensorData;

            setSensorData({
              lat: data.lat !== 0 ? data.lat.toFixed(5) : "Inválido",
              lng: data.lng !== 0 ? data.lng.toFixed(5) : "Inválido",
              distancia: data.distancia.toFixed(1),
              ppm: data.ppm.toFixed(0),
            });
          } catch (e) {
            console.error("Erro ao processar a mensagem JSON:", e);
          }
        });
      } catch (error) {
        console.error("Falha ao iniciar cliente MQTT: ", error);
        setStatus("Erro de Conexão");
      }

      // Função de limpeza para desconectar quando o app fechar
      return () => {
        if (clientRef.current) {
          console.log("Desconectando cliente MQTT...");
          clientRef.current.end();
          clientRef.current = null;
        }
      };
    } else {
      return;
    }
  }, [Mockar]); // Array de dependências vazio garante que o efeito rode apenas uma vez

  useEffect(() => {
    if (Mockar !== false) {
      console.log("Mockando dados...");

      // Mockando dados
      const mockData: IncomingSensorData = {
        lat: Math.random() * 90,
        lng: Math.random() * 180 - 90,
        distancia: Math.random() * 1000,
        ppm: Math.random() * 1000,
      };

      const interval = setInterval(() => {
        setSensorData((prevData) => ({
          ...prevData,
          lat: mockData.lat.toFixed(5),
          lng: mockData.lng.toFixed(5),
          distancia: mockData.distancia.toFixed(1),
          ppm: mockData.ppm.toFixed(0),
        }));
        console.log("Dados mockados com sucesso.");
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [Mockar]);

  const getStatusStyle = () => {
    switch (status) {
      case "Conectado":
      case "Conectando...":
        return styles.statusConectado;
      default:
        return styles.statusDesconectado;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={Platform.OS === "ios" ? "dark-content" : "default"}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard de Sensores</Text>
          <View style={[styles.statusBadge, getStatusStyle()]}>
            <Text
              style={styles.statusText}
              onPress={() => setMockar((prev) => !prev)}
            >
              {status}
            </Text>
          </View>
        </View>

        <SensorCard title="📍 Localização GPS">
          <DataDisplay label="Latitude" value={sensorData.lat} unit="" />
          <DataDisplay label="Longitude" value={sensorData.lng} unit="" />
        </SensorCard>

        <SensorCard title="📏 Distância">
          <DataDisplay value={sensorData.distancia} unit="cm" />
        </SensorCard>

        <SensorCard title="💨 Qualidade do Ar">
          <DataDisplay value={sensorData.ppm} unit="PPM" />
        </SensorCard>
      </ScrollView>
    </SafeAreaView>
  );
}

// O StyleSheet permanece o mesmo, pois já é fortemente tipado por padrão.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  container: {
    padding: 20,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1a237e",
    marginBottom: 15,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  statusText: {
    fontWeight: "bold",
    color: "#fff",
  },
  statusConectado: {
    backgroundColor: "#2e7d32",
  },
  statusDesconectado: {
    backgroundColor: "#c62828",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 25,
    width: "100%",
    maxWidth: 400,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#3f51b5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 10,
    marginBottom: 15,
    textAlign: "center",
  },
  dataContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  dataLabel: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  dataValue: {
    fontSize: 40,
    fontWeight: "700",
    color: "#2c3e50",
  },
  dataUnit: {
    fontSize: 20,
    fontWeight: "normal",
    color: "#7f8c8d",
  },
});
