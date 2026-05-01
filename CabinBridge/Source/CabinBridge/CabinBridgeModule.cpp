#include "CabinBridgeModule.h"
#include "Modules/ModuleManager.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY_STATIC(LogCabinBridge, Log, All);

void FCabinBridgeModule::StartupModule()
{
    UE_LOG(LogCabinBridge, Log, TEXT("CabinBridge plugin loaded."));
}

void FCabinBridgeModule::ShutdownModule()
{
    UE_LOG(LogCabinBridge, Log, TEXT("CabinBridge plugin unloaded."));
}

IMPLEMENT_MODULE(FCabinBridgeModule, CabinBridge)
