#include <WiFiClient.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
// #include <TinyGPS++.h>       // <-- BIBLIOTECA DO GPS COMENTADA
// #include <HardwareSerial.h>  // <-- BIBLIOTECA DO GPS COMENTADA
#include <MQ135.h>
#include <ArduinoJson.h>

// --- Configurações de Rede e MQTT (substitua com as suas) ---
#define SSID "ESP8266"
#define PASSWORD "ESP8266"
const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic = "meu/esp32/sensordata"; // Tópico único para todos os dados

// --- Pinos dos Sensores ---
// Sensor Ultrassônico HC-SR04
#define TRIGGER_PIN 5
#define ECHO_PIN 4

// Sensor de Qualidade do Ar MQ-135
#define MQ135_PIN A0 // Use um pino ADC. Ex: 34 no ESP32, A0 no ESP8266

// --- SEÇÃO DE PINOS DO GPS COMENTADA ---
// #define RXD1 16
// #define TXD1 17

// --- Objetos e Variáveis Globais ---
WiFiClient espClient;
PubSubClient client(espClient);
// TinyGPSPlus gps;              // <-- OBJETO DO GPS COMENTADO
// HardwareSerial SerialGPS(1);  // <-- OBJETO DO GPS COMENTADO
MQ135 gasSensor = MQ135(MQ135_PIN);

unsigned long ultimoEnvio = 0;
const long intervaloEnvio = 5000; // Enviar dados a cada 5 segundos

void setup() {
  Serial.begin(115200);

  // Inicia sensores
  pinMode(TRIGGER_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // --- INICIALIZAÇÃO DO GPS COMENTADA ---
  // SerialGPS.begin(9600, SERIAL_8N1, RXD1, TXD1);

  // Conecta ao Wi-Fi
  setup_wifi();
  
  // Conecta ao MQTT
  client.setServer(mqtt_server, 1883);
  
  Serial.println("Setup completo. Aguardando leituras...");
  // Dê tempo para o MQ135 aquecer um pouco
  delay(2000);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Conectando a ");
  Serial.println(SSID);
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado!");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Tentando conectar ao MQTT...");
    if (client.connect("ESP32_Sensor_Client")) {
      Serial.println("Conectado!");
    } else {
      Serial.print("falhou, rc=");
      Serial.print(client.state());
      Serial.println(" tentando novamente em 5 segundos");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // --- LEITURA DE DADOS DO GPS COMENTADA ---
  // while (SerialGPS.available() > 0) {
  //   gps.encode(SerialGPS.read());
  // }

  // Verifica se é hora de enviar os dados
  if (millis() - ultimoEnvio > intervaloEnvio) {
    ultimoEnvio = millis();

    // --- Leitura dos Sensores ---
    // 1. Distância (HC-SR04)
    digitalWrite(TRIGGER_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGGER_PIN, LOW);
    long duracao = pulseIn(ECHO_PIN, HIGH);
    float distancia = duracao * 0.034 / 2.0;

    // 2. Qualidade do Ar (MQ-135)
    float ppm = gasSensor.getPPM();

    // --- Criação do JSON ---
    StaticJsonDocument<256> doc;

    // Adiciona os dados ao documento JSON
    doc["distancia"] = distancia;
    doc["ppm"] = ppm;

    // --- ADIÇÃO DOS DADOS DE GPS AO JSON COMENTADA ---
    // if (gps.location.isValid()) {
    //   doc["lat"] = gps.location.lat();
    //   doc["lng"] = gps.location.lng();
    // } else {
    //   doc["lat"] = 0;
    //   doc["lng"] = 0;
    // }
    
    // Para garantir que a página web não quebre, podemos enviar valores nulos ou fixos.
    doc["lat"] = 0;
    doc["lng"] = 0;


    // Serializa o JSON para uma string
    char buffer[256];
    serializeJson(doc, buffer);

    // Publica no tópico MQTT
    client.publish(mqtt_topic, buffer);

    Serial.print("Publicado: ");
    Serial.println(buffer);
  }
}