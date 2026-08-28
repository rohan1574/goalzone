import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Info } from "lucide-react-native";
import { router } from "expo-router";

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-4 py-4 bg-black border-b border-white/5">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 active:opacity-70"
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text className="text-white font-extrabold text-lg tracking-wide">
          Privacy policy
        </Text>
        
        <View className="w-8" />
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* SCTV Policy geometric banner (styled to match Screenshot 1) */}
        <View className="bg-[#2E3C45] h-40 relative justify-between p-4 overflow-hidden">
          {/* Overlapping diagonal vector lines for geometric pattern */}
          <View className="absolute inset-0 opacity-15">
            <View className="absolute border border-white w-96 h-96 -top-40 -left-20 rotate-45" />
            <View className="absolute border border-white w-80 h-80 -bottom-20 -right-10 -rotate-12" />
            <View className="absolute border border-white w-60 h-60 top-20 right-40 rotate-12" />
          </View>
          
          <Text className="text-white/40 text-xs font-semibold">
            SCTV Policy
          </Text>

          <View className="items-center justify-center flex-1 pb-2">
            <Text className="text-white text-3xl font-extralight tracking-widest uppercase">
              SCTV Policy
            </Text>
          </View>
        </View>

        {/* Content body */}
        <View className="px-5 py-6">
          <Text className="text-black font-extrabold text-lg mb-4">
            Privacy Policy
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            Store built the app as a Free mobile game. This SERVICE is provided by Store at no cost and is intended for use as is.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            This page is used to inform visitors regarding our policies with the collection, use, and disclosure of Personal Information if anyone decided to use our Service.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            If you choose to use our Service, then you agree to the collection and use of information in relation to this policy. The Personal Information that we collect is used for providing and improving the Service. We will not use or share your information with anyone except as described in this Privacy Policy.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            The terms used in this Privacy Policy have the same meanings as in our Terms and Conditions, which is accessible at game unless otherwise defined in this Privacy Policy.
          </Text>

          {/* Section: Information Collection and Use */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Information Collection and Use
          </Text>

          <View className="flex-row mb-4">
            <View className="mr-2 mt-1">
              <Info size={16} color="#333" />
            </View>
            <Text className="flex-1 text-gray-800 text-sm leading-6">
              For a better experience, while using our Service, we may require you to provide us with certain personally identifiable information. The information that we request will be retained by us and used as described in this privacy policy.
            </Text>
          </View>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            The app does use third party services that may collect information used to identify you.
          </Text>

          <Text className="text-gray-800 text-sm font-bold leading-6 mb-3">
            Link to privacy policy of third party service providers used by the app
          </Text>

          {/* Third party links list */}
          <View className="pl-4 mb-6">
            {[
              "Google Play Services",
              "AdMob",
              "Firebase Crashlytics",
              "Facebook",
              "Unity",
              "AppLovin",
            ].map((service, index) => (
              <TouchableOpacity key={index} className="py-2 active:opacity-60">
                <Text className="text-blue-600 font-bold text-sm underline">
                  {service}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section: Log Data */}
          <Text className="text-black font-extrabold text-base mt-4 mb-3">
            Log Data
          </Text>
          
          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We want to inform you that whenever you use our Service, in a case of an error in the app we collect data and information (through third party products) on your phone called Log Data. This Log Data may include information such as your device Internet Protocol ("IP") address, device name, operating system version, the configuration of the app when utilizing our Service, the time and date of your use of the Service, and other statistics.
          </Text>

          {/* Section: Cookies */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Cookies
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            Cookies are files with a small amount of data that are commonly used as anonymous unique identifiers. These are sent to your browser from the websites that you visit and are stored on your device's internal memory.
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            This Service does not use these "cookies" explicitly. However, the app may use third party code and libraries that use "cookies" to collect information and improve their services. You have the option to either accept or refuse these cookies and know when a cookie is being sent to your device. If you choose to refuse our cookies, you may not be able to use some portions of this Service.
          </Text>

          {/* Section: Service Providers */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Service Providers
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-3">
            We may employ third-party companies and individuals due to the following reasons:
          </Text>

          <View className="pl-4 mb-4">
            {[
              "To facilitate our Service;",
              "To provide the Service on our behalf;",
              "To perform Service-related services; or",
              "To assist us in analyzing how our Service is used.",
            ].map((bullet, index) => (
              <Text key={index} className="text-gray-800 text-sm leading-6 mb-1.5">
                • {bullet}
              </Text>
            ))}
          </View>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We want to inform users of this Service that these third parties have access to your Personal Information. The reason is to perform the tasks assigned to them on our behalf. However, they are obligated not to disclose or use the information for any other purpose.
          </Text>

          {/* Section: Security */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Security
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We value your trust in providing us your Personal Information, thus we are striving to use commercially acceptable means of protecting it. But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security.
          </Text>

          {/* Section: Links to Other Sites */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Links to Other Sites
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            This Service may contain links to other sites. If you click on a third-party link, you will be directed to that site. Note that these external sites are not operated by us. Therefore, we strongly advise you to review the Privacy Policy of these websites. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.
          </Text>

          {/* Section: Children's Privacy */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Children's Privacy
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            These Services do not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13 years of age. In the case we discover that a child under 13 has provided us with personal information, we immediately delete this from our servers. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us so that we will be able to do necessary actions.
          </Text>

          {/* Section: Changes to This Privacy Policy */}
          <View className="flex-row items-center mt-6 mb-3">
            <View className="mr-2">
              <Info size={18} color="#000" />
            </View>
            <Text className="text-black font-extrabold text-base">
              Changes to This Privacy Policy
            </Text>
          </View>

          <Text className="text-gray-800 text-sm leading-6 mb-4">
            We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page.
          </Text>

          {/* Section: Contact Us */}
          <Text className="text-black font-extrabold text-base mt-6 mb-3">
            Contact Us
          </Text>

          <Text className="text-gray-800 text-sm leading-6 mb-6">
            If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at{" "}
            <Text className="text-blue-600 font-bold underline">
              mrrony1574@gmail.com
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
