using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace AudioSwitch
{
    // COM interfaces for audio device management
    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        int Activate([MarshalAs(UnmanagedType.LPStruct)] Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
        int GetState(out int pdwState);
    }

    [ComImport]
    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection
    {
        int GetCount(out int pcDevices);
        int Item(int nDevice, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
        int RegisterEndpointNotificationCallback(IntPtr pClient);
        int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    [ComImport]
    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        int GetCount(out int cProps);
        int GetAt(int iProp, out PropertyKey pkey);
        int GetValue(ref PropertyKey key, out PropVariant pv);
        int SetValue(ref PropertyKey key, ref PropVariant propvar);
        int Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey
    {
        public Guid fmtid;
        public int pid;
        public PropertyKey(Guid fmtid, int pid) { this.fmtid = fmtid; this.pid = pid; }
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropVariant
    {
        public ushort vt;
        public ushort wReserved1, wReserved2, wReserved3;
        public IntPtr p;
        public int p2;

        public string GetString()
        {
            if (vt == 31) // VT_LPWSTR
                return Marshal.PtrToStringUni(p);
            return null;
        }
    }

    // PolicyConfig for setting default devices
    [ComImport]
    [Guid("F8679F50-850A-41CF-9C72-430F290290C8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig
    {
        int GetMixFormat(string pszDeviceName, IntPtr ppFormat);
        int GetDeviceFormat(string pszDeviceName, int bDefault, IntPtr ppFormat);
        int ResetDeviceFormat(string pszDeviceName);
        int SetDeviceFormat(string pszDeviceName, IntPtr pEndpointFormat, IntPtr pMixFormat);
        int GetProcessingPeriod(string pszDeviceName, int bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
        int SetProcessingPeriod(string pszDeviceName, IntPtr pmftPeriod);
        int GetShareMode(string pszDeviceName, IntPtr pMode);
        int SetShareMode(string pszDeviceName, IntPtr mode);
        int GetPropertyValue(string pszDeviceName, int bFxStore, IntPtr key, IntPtr pv);
        int SetPropertyValue(string pszDeviceName, int bFxStore, IntPtr key, IntPtr pv);
        int SetDefaultEndpoint(string pszDeviceName, int role);
        int SetEndpointVisibility(string pszDeviceName, int bVisible);
    }

    [ComImport]
    [Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    class PolicyConfigClient { }

    class Program
    {
        static PropertyKey PKEY_Device_FriendlyName = new PropertyKey(
            new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), 14);

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            if (args.Length == 0)
            {
                Console.WriteLine("Usage: AudioSwitch.exe list [input|output]|set <deviceId> [input|output]");
                return;
            }

            string command = args[0].ToLower();
            string deviceType = args.Length > 1 && (args[1].ToLower() == "input" || args[1].ToLower() == "output") ? args[1].ToLower() : "output";

            if (command == "list")
            {
                ListDevices(deviceType);
            }
            else if (command == "set" && args.Length > 1)
            {
                string deviceId = args[1];
                string setDeviceType = args.Length > 2 && (args[2].ToLower() == "input" || args[2].ToLower() == "output") ? args[2].ToLower() : "output";
                SetDefaultDevice(deviceId, setDeviceType);
            }
            else
            {
                Console.WriteLine("Usage: AudioSwitch.exe list [input|output]|set <deviceId> [input|output]");
            }
        }

        static void ListDevices(string deviceType)
        {
            try
            {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
                IMMDeviceCollection collection;
                // eRender = 0 (output), eCapture = 1 (input), DEVICE_STATE_ACTIVE = 1
                int dataFlow = deviceType == "input" ? 1 : 0;
                enumerator.EnumAudioEndpoints(dataFlow, 1, out collection);

                int count;
                collection.GetCount(out count);

                // Get current defaults (only for output devices)
                string defaultId = "";
                string defaultCommId = "";
                if (dataFlow == 0) // Only for output devices
                {
                    try
                    {
                        IMMDevice defaultDevice;
                        enumerator.GetDefaultAudioEndpoint(0, 0, out defaultDevice); // eConsole
                        defaultDevice.GetId(out defaultId);
                    }
                    catch { }
                    try
                    {
                        IMMDevice defaultCommDevice;
                        enumerator.GetDefaultAudioEndpoint(0, 2, out defaultCommDevice); // eCommunications
                        defaultCommDevice.GetId(out defaultCommId);
                    }
                    catch { }
                }

                Console.Write("[");
                bool first = true;
                for (int i = 0; i < count; i++)
                {
                    IMMDevice device;
                    collection.Item(i, out device);

                    string id;
                    device.GetId(out id);

                    IPropertyStore props;
                    device.OpenPropertyStore(0, out props);

                    PropVariant nameVar;
                    props.GetValue(ref PKEY_Device_FriendlyName, out nameVar);
                    string name = nameVar.GetString() ?? "Unknown";

                    // Escape JSON
                    name = name.Replace("\\", "\\\\").Replace("\"", "\\\"");
                    id = id.Replace("\\", "\\\\").Replace("\"", "\\\"");

                    bool isDefault = id == defaultId;
                    bool isDefaultComm = id == defaultCommId;

                    if (!first) Console.Write(",");
                    first = false;
                    Console.Write("{\"id\":\"" + id + "\",\"name\":\"" + name + "\",\"default\":" + (isDefault ? "true" : "false") + ",\"defaultComm\":" + (isDefaultComm ? "true" : "false") + "}");
                }
                Console.WriteLine("]");
            }
            catch (Exception ex)
            {
                string msg = ex.Message.Replace("\\", "\\\\").Replace("\"", "\\\"");
                Console.WriteLine("{\"error\":\"" + msg + "\"}");
            }
        }

        static void SetDefaultDevice(string deviceId, string deviceType)
        {
            try
            {
                var policyConfig = (IPolicyConfig)new PolicyConfigClient();
                if (deviceType == "input")
                {
                    // For input devices: 0 = eConsole (default recording), 1 = eMultimedia, 2 = eCommunications
                    policyConfig.SetDefaultEndpoint(deviceId, 0); // Console (default recording)
                    policyConfig.SetDefaultEndpoint(deviceId, 1); // Multimedia
                    policyConfig.SetDefaultEndpoint(deviceId, 2); // Communications (Discord, Teams, etc.)
                }
                else
                {
                    // For output devices: 0 = eConsole, 1 = eMultimedia, 2 = eCommunications
                    policyConfig.SetDefaultEndpoint(deviceId, 0); // Console (games, media players)
                    policyConfig.SetDefaultEndpoint(deviceId, 1); // Multimedia
                    policyConfig.SetDefaultEndpoint(deviceId, 2); // Communications (Discord, Teams, etc.)
                }
                Console.WriteLine("{\"success\":true}");
            }
            catch (Exception ex)
            {
                string msg = ex.Message.Replace("\\", "\\\\").Replace("\"", "\\\"");
                Console.WriteLine("{\"success\":false,\"error\":\"" + msg + "\"}");
            }
        }
    }
}
