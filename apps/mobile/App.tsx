import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import type { Patient } from "@wardlink/shared";

// Just proving the shared package wires up correctly end to end.
const samplePatient: Pick<Patient, "demographics"> = {
  demographics: { name: "Sample Patient", age: 34, sex: "F", allergies: "None known" },
};

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Ward Link NG</Text>
      <Text style={styles.subtitle}>Mobile app scaffold is running.</Text>
      <Text style={styles.sample}>Shared types loaded: {samplePatient.demographics.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B2B3A",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#9FB4BF",
    fontSize: 14,
    marginBottom: 16,
  },
  sample: {
    color: "#3FA88A",
    fontSize: 13,
  },
});
