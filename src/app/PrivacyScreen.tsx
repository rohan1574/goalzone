import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Info } from "lucide-react-native";
import {
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 bg-black border-b border-white/5">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 active:opacity-70"
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text className="text-white font-extrabold text-lg tracking-wide">
          Privacy Policy
        </Text>

        <View className="w-8" />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Banner */}
        <View className="bg-[#2E3C45] h-40 relative justify-center items-center p-4 overflow-hidden">
          <View className="absolute inset-0 opacity-10">
            <View className="absolute border border-white w-96 h-96 -top-40 -left-20 rotate-45" />
            <View className="absolute border border-white w-80 h-80 -bottom-20 -right-10 -rotate-12" />
          </View>

          <Text className="text-white text-3xl font-extralight tracking-widest uppercase">
            NJR10 Live
          </Text>

          <Text className="text-white/60 text-xs mt-2">Privacy Policy</Text>
        </View>

        {/* Content */}
        <View className="px-5 py-6">
          <Text className="text-black font-extrabold text-lg mb-4">
            Privacy Policy
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live is a football application that provides football scores,
            fixtures, team information, news, highlights, predictions and other
            football-related content.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            This Privacy Policy explains how information may be handled when you
            use the NJR10 Live application. NJR10 Live does not require users to
            create an account or log in to use the application.
          </Text>

          {/* Information Collection */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Information Collection and Use
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live does not directly ask users to provide personal
            information such as their name, phone number, home address or
            account password.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            However, third-party services used by the application may
            automatically process certain information necessary to provide
            advertising, notifications, security, diagnostics or other services.
            The types of information handled depend on the third-party service
            and its configuration.
          </Text>

          {/* Third Party Services */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Third-Party Services
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live uses the following third-party services:
          </Text>

          <View className="pl-2 mb-4">
            <Text className="text-gray-800 text-sm leading-6 mb-3">
              â€¢ Google AdMob â€” used to display advertisements in the
              application.
            </Text>

            <Text className="text-gray-800 text-sm leading-6 mb-3">
              â€¢ Firebase Cloud Messaging â€” used to deliver push
              notifications to users.
            </Text>

            <Text className="text-gray-800 text-sm leading-6 mb-3">
              â€¢ Football API â€” used to retrieve football-related information
              such as scores, fixtures, teams and other football data.
            </Text>
          </View>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            These third-party providers may process information according to
            their own privacy policies and terms. NJR10 Live does not control
            how these third-party services process information outside the
            application.
          </Text>

          {/* Advertising */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Advertising
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live uses Google AdMob to display advertisements. AdMob may
            collect or process information such as advertising identifiers,
            device information, IP address, approximate location and
            interactions with advertisements, depending on the user's device,
            consent choices and applicable settings.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            Advertising information may be used to provide, measure and improve
            advertisements and to help prevent fraud and abuse.
          </Text>

          {/* Football API */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Football Data
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live uses a third-party football data API to retrieve
            football-related information. This may include match scores,
            fixtures, team information, league information and other
            football-related data.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live does not intentionally send users' personal information
            to the football data API.
          </Text>

          {/* Notifications */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Push Notifications
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live may use Firebase Cloud Messaging to send push
            notifications, such as football updates, match information and other
            app-related notifications.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            Notification delivery may require a device or messaging token
            provided by Firebase. These tokens are used to deliver notifications
            to the appropriate device and are not used by NJR10 Live to identify
            users personally.
          </Text>

          {/* Log Data */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Log and Technical Data
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            In certain circumstances, third-party services may automatically
            process technical information when the application is used. This may
            include information such as IP address, device type, operating
            system version, application version, date and time of use, and other
            technical or diagnostic information.
          </Text>

          {/* Cookies */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Cookies and Similar Technologies
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live itself does not intentionally use browser cookies.
            However, third-party services integrated into the application may
            use technologies that perform similar functions as described in
            their respective privacy policies.
          </Text>

          {/* Data Security */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Data Security
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We take reasonable steps to protect information handled through the
            application. However, no method of transmission over the Internet or
            electronic storage is completely secure, and we cannot guarantee
            absolute security.
          </Text>

          {/* Children's Privacy */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Children's Privacy
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live is intended for users aged 18 and over. The application
            is not directed toward children under the age of 13, and we do not
            knowingly collect personal information directly from children under
            13.
          </Text>

          {/* External Links */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Links to Other Websites
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            NJR10 Live may contain links to external websites or services,
            including football news and video platforms. These external websites
            are not operated by NJR10 Live. We recommend reviewing the privacy
            policies of any external service you visit.
          </Text>

          {/* Changes */}
          <View className="flex-row items-center mt-6 mb-3">
            <View className="mr-2">
              <Info size={18} color="#000" />
            </View>

            <Text className="text-black font-extrabold text-base">
              Changes to This Privacy Policy
            </Text>
          </View>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We may update this Privacy Policy from time to time. Any changes
            will be reflected on this page. You are encouraged to review this
            Privacy Policy periodically for updates.
          </Text>

          {/* Contact */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Contact Us
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-6">
            If you have any questions or suggestions about this Privacy Policy,
            please contact us at{" "}
            <Text
              className="text-blue-600 font-bold underline"
              onPress={() =>
                Linking.openURL("mailto:rjsavetimes1574@gmail.com")
              }
            >
              rjsavetimes1574@gmail.com
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
