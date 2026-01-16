import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';

// LiveSchool brand colors
const colors = {
  primary: '#6F71EE',
  dark: '#101E57',
  gray: '#667085',
  lightGray: '#F6F6F9',
  green: '#417762',
};

const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  border: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  innerBorder: {
    position: 'absolute',
    top: 25,
    left: 25,
    right: 25,
    bottom: 25,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
    letterSpacing: 2,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    letterSpacing: 1,
  },
  content: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  presentedTo: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 10,
  },
  name: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
    marginBottom: 20,
  },
  eventSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  forAttending: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 8,
  },
  eventName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 30,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: colors.gray,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 12,
    color: colors.dark,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 50,
    right: 50,
    alignItems: 'center',
  },
  signatureLine: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
    marginBottom: 5,
  },
  hostName: {
    fontSize: 12,
    color: colors.dark,
  },
  hostTitle: {
    fontSize: 10,
    color: colors.gray,
  },
  certificateId: {
    position: 'absolute',
    bottom: 30,
    right: 50,
    fontSize: 8,
    color: colors.gray,
  },
});

interface CertificateProps {
  attendeeName: string;
  eventName: string;
  eventDate: string;
  duration: number;
  hostName: string;
  certificateId: string;
}

export default function CertificateDocument({
  attendeeName,
  eventName,
  eventDate,
  duration,
  hostName,
  certificateId,
}: CertificateProps) {
  const formattedDate = format(parseISO(eventDate), 'MMMM d, yyyy');
  const formattedTime = format(parseISO(eventDate), 'h:mm a');

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Decorative borders */}
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        {/* Header */}
        <View style={styles.header}>
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            style={styles.logo}
          />
          <Text style={styles.title}>CERTIFICATE OF ATTENDANCE</Text>
          <Text style={styles.subtitle}>Professional Development</Text>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.presentedTo}>This certificate is presented to</Text>
          <Text style={styles.name}>{attendeeName}</Text>

          <View style={styles.eventSection}>
            <Text style={styles.forAttending}>for attending the session</Text>
            <Text style={styles.eventName}>{eventName}</Text>
          </View>

          <View style={styles.details}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DATE</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>TIME</Text>
              <Text style={styles.detailValue}>{formattedTime}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DURATION</Text>
              <Text style={styles.detailValue}>{duration} minutes</Text>
            </View>
          </View>
        </View>

        {/* Footer with signature */}
        <View style={styles.footer}>
          <View style={styles.signatureLine} />
          <Text style={styles.hostName}>{hostName}</Text>
          <Text style={styles.hostTitle}>Session Host</Text>
        </View>

        {/* Certificate ID for verification */}
        <Text style={styles.certificateId}>Certificate ID: {certificateId}</Text>
      </Page>
    </Document>
  );
}
