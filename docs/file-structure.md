# File Structure

```
.
├── automation
│   ├── node_modules
│   │   ├── .bin
│   │   │   ├── playwright
│   │   │   └── playwright-core
│   │   ├── @playwright
│   │   │   └── test
│   │   │       ├── LICENSE
│   │   │       ├── NOTICE
│   │   │       ├── README.md
│   │   │       ├── cli.js
│   │   │       ├── index.d.ts
│   │   │       ├── index.js
│   │   │       ├── index.mjs
│   │   │       ├── package.json
│   │   │       ├── reporter.d.ts
│   │   │       ├── reporter.js
│   │   │       └── reporter.mjs
│   │   ├── playwright
│   │   │   ├── lib
│   │   │   │   ├── agents
│   │   │   │   │   ├── agentParser.js
│   │   │   │   │   ├── copilot-setup-steps.yml
│   │   │   │   │   ├── generateAgents.js
│   │   │   │   │   ├── playwright-test-coverage.prompt.md
│   │   │   │   │   ├── playwright-test-generate.prompt.md
│   │   │   │   │   ├── playwright-test-generator.agent.md
│   │   │   │   │   ├── playwright-test-heal.prompt.md
│   │   │   │   │   ├── playwright-test-healer.agent.md
│   │   │   │   │   ├── playwright-test-plan.prompt.md
│   │   │   │   │   └── playwright-test-planner.agent.md
│   │   │   │   ├── common
│   │   │   │   │   ├── config.js
│   │   │   │   │   ├── configLoader.js
│   │   │   │   │   ├── esmLoaderHost.js
│   │   │   │   │   ├── expectBundle.js
│   │   │   │   │   ├── expectBundleImpl.js
│   │   │   │   │   ├── fixtures.js
│   │   │   │   │   ├── globals.js
│   │   │   │   │   ├── ipc.js
│   │   │   │   │   ├── poolBuilder.js
│   │   │   │   │   ├── process.js
│   │   │   │   │   ├── suiteUtils.js
│   │   │   │   │   ├── test.js
│   │   │   │   │   ├── testLoader.js
│   │   │   │   │   ├── testType.js
│   │   │   │   │   └── validators.js
│   │   │   │   ├── isomorphic
│   │   │   │   │   ├── events.js
│   │   │   │   │   ├── folders.js
│   │   │   │   │   ├── stringInternPool.js
│   │   │   │   │   ├── teleReceiver.js
│   │   │   │   │   ├── teleSuiteUpdater.js
│   │   │   │   │   ├── testServerConnection.js
│   │   │   │   │   ├── testServerInterface.js
│   │   │   │   │   ├── testTree.js
│   │   │   │   │   └── types.d.js
│   │   │   │   ├── loader
│   │   │   │   │   └── loaderMain.js
│   │   │   │   ├── matchers
│   │   │   │   │   ├── expect.js
│   │   │   │   │   ├── matcherHint.js
│   │   │   │   │   ├── matchers.js
│   │   │   │   │   ├── toBeTruthy.js
│   │   │   │   │   ├── toEqual.js
│   │   │   │   │   ├── toHaveURL.js
│   │   │   │   │   ├── toMatchAriaSnapshot.js
│   │   │   │   │   ├── toMatchSnapshot.js
│   │   │   │   │   └── toMatchText.js
│   │   │   │   ├── mcp
│   │   │   │   │   └── test
│   │   │   │   │       ├── browserBackend.js
│   │   │   │   │       ├── generatorTools.js
│   │   │   │   │       ├── plannerTools.js
│   │   │   │   │       ├── seed.js
│   │   │   │   │       ├── streams.js
│   │   │   │   │       ├── testBackend.js
│   │   │   │   │       ├── testContext.js
│   │   │   │   │       ├── testTool.js
│   │   │   │   │       └── testTools.js
│   │   │   │   ├── plugins
│   │   │   │   │   ├── gitCommitInfoPlugin.js
│   │   │   │   │   ├── index.js
│   │   │   │   │   └── webServerPlugin.js
│   │   │   │   ├── reporters
│   │   │   │   │   ├── versions
│   │   │   │   │   │   └── blobV1.js
│   │   │   │   │   ├── base.js
│   │   │   │   │   ├── blob.js
│   │   │   │   │   ├── dot.js
│   │   │   │   │   ├── empty.js
│   │   │   │   │   ├── github.js
│   │   │   │   │   ├── html.js
│   │   │   │   │   ├── internalReporter.js
│   │   │   │   │   ├── json.js
│   │   │   │   │   ├── junit.js
│   │   │   │   │   ├── line.js
│   │   │   │   │   ├── list.js
│   │   │   │   │   ├── listModeReporter.js
│   │   │   │   │   ├── markdown.js
│   │   │   │   │   ├── merge.js
│   │   │   │   │   ├── multiplexer.js
│   │   │   │   │   ├── reporterV2.js
│   │   │   │   │   └── teleEmitter.js
│   │   │   │   ├── runner
│   │   │   │   │   ├── dispatcher.js
│   │   │   │   │   ├── failureTracker.js
│   │   │   │   │   ├── lastRun.js
│   │   │   │   │   ├── loadUtils.js
│   │   │   │   │   ├── loaderHost.js
│   │   │   │   │   ├── processHost.js
│   │   │   │   │   ├── projectUtils.js
│   │   │   │   │   ├── rebase.js
│   │   │   │   │   ├── reporters.js
│   │   │   │   │   ├── sigIntWatcher.js
│   │   │   │   │   ├── taskRunner.js
│   │   │   │   │   ├── tasks.js
│   │   │   │   │   ├── testGroups.js
│   │   │   │   │   ├── testRunner.js
│   │   │   │   │   ├── testServer.js
│   │   │   │   │   ├── uiModeReporter.js
│   │   │   │   │   ├── vcs.js
│   │   │   │   │   ├── watchMode.js
│   │   │   │   │   └── workerHost.js
│   │   │   │   ├── third_party
│   │   │   │   │   ├── pirates.js
│   │   │   │   │   └── tsconfig-loader.js
│   │   │   │   ├── transform
│   │   │   │   │   ├── babelBundle.js
│   │   │   │   │   ├── babelBundleImpl.js
│   │   │   │   │   ├── compilationCache.js
│   │   │   │   │   ├── esmLoader.js
│   │   │   │   │   ├── portTransport.js
│   │   │   │   │   └── transform.js
│   │   │   │   ├── worker
│   │   │   │   │   ├── fixtureRunner.js
│   │   │   │   │   ├── testInfo.js
│   │   │   │   │   ├── testTracing.js
│   │   │   │   │   ├── timeoutManager.js
│   │   │   │   │   ├── util.js
│   │   │   │   │   └── workerMain.js
│   │   │   │   ├── errorContext.js
│   │   │   │   ├── fsWatcher.js
│   │   │   │   ├── index.js
│   │   │   │   ├── internalsForTest.js
│   │   │   │   ├── program.js
│   │   │   │   ├── reportActions.js
│   │   │   │   ├── testActions.js
│   │   │   │   ├── util.js
│   │   │   │   ├── utilsBundle.js
│   │   │   │   └── utilsBundleImpl.js
│   │   │   ├── types
│   │   │   │   ├── test.d.ts
│   │   │   │   └── testReporter.d.ts
│   │   │   ├── LICENSE
│   │   │   ├── NOTICE
│   │   │   ├── README.md
│   │   │   ├── ThirdPartyNotices.txt
│   │   │   ├── cli.js
│   │   │   ├── index.d.ts
│   │   │   ├── index.js
│   │   │   ├── index.mjs
│   │   │   ├── jsx-runtime.js
│   │   │   ├── jsx-runtime.mjs
│   │   │   ├── package.json
│   │   │   ├── test.d.ts
│   │   │   ├── test.js
│   │   │   └── test.mjs
│   │   ├── playwright-core
│   │   │   ├── bin
│   │   │   │   ├── install_media_pack.ps1
│   │   │   │   ├── install_webkit_wsl.ps1
│   │   │   │   ├── reinstall_chrome_beta_linux.sh
│   │   │   │   ├── reinstall_chrome_beta_mac.sh
│   │   │   │   ├── reinstall_chrome_beta_win.ps1
│   │   │   │   ├── reinstall_chrome_stable_linux.sh
│   │   │   │   ├── reinstall_chrome_stable_mac.sh
│   │   │   │   ├── reinstall_chrome_stable_win.ps1
│   │   │   │   ├── reinstall_msedge_beta_linux.sh
│   │   │   │   ├── reinstall_msedge_beta_mac.sh
│   │   │   │   ├── reinstall_msedge_beta_win.ps1
│   │   │   │   ├── reinstall_msedge_dev_linux.sh
│   │   │   │   ├── reinstall_msedge_dev_mac.sh
│   │   │   │   ├── reinstall_msedge_dev_win.ps1
│   │   │   │   ├── reinstall_msedge_stable_linux.sh
│   │   │   │   ├── reinstall_msedge_stable_mac.sh
│   │   │   │   └── reinstall_msedge_stable_win.ps1
│   │   │   ├── lib
│   │   │   │   ├── cli
│   │   │   │   │   ├── browserActions.js
│   │   │   │   │   ├── driver.js
│   │   │   │   │   ├── installActions.js
│   │   │   │   │   ├── program.js
│   │   │   │   │   └── programWithTestStub.js
│   │   │   │   ├── client
│   │   │   │   │   ├── android.js
│   │   │   │   │   ├── api.js
│   │   │   │   │   ├── artifact.js
│   │   │   │   │   ├── browser.js
│   │   │   │   │   ├── browserContext.js
│   │   │   │   │   ├── browserType.js
│   │   │   │   │   ├── cdpSession.js
│   │   │   │   │   ├── channelOwner.js
│   │   │   │   │   ├── clientHelper.js
│   │   │   │   │   ├── clientInstrumentation.js
│   │   │   │   │   ├── clientStackTrace.js
│   │   │   │   │   ├── clock.js
│   │   │   │   │   ├── connect.js
│   │   │   │   │   ├── connection.js
│   │   │   │   │   ├── consoleMessage.js
│   │   │   │   │   ├── coverage.js
│   │   │   │   │   ├── debugger.js
│   │   │   │   │   ├── dialog.js
│   │   │   │   │   ├── disposable.js
│   │   │   │   │   ├── download.js
│   │   │   │   │   ├── electron.js
│   │   │   │   │   ├── elementHandle.js
│   │   │   │   │   ├── errors.js
│   │   │   │   │   ├── eventEmitter.js
│   │   │   │   │   ├── events.js
│   │   │   │   │   ├── fetch.js
│   │   │   │   │   ├── fileChooser.js
│   │   │   │   │   ├── fileUtils.js
│   │   │   │   │   ├── frame.js
│   │   │   │   │   ├── harRouter.js
│   │   │   │   │   ├── input.js
│   │   │   │   │   ├── jsHandle.js
│   │   │   │   │   ├── jsonPipe.js
│   │   │   │   │   ├── localUtils.js
│   │   │   │   │   ├── locator.js
│   │   │   │   │   ├── network.js
│   │   │   │   │   ├── page.js
│   │   │   │   │   ├── platform.js
│   │   │   │   │   ├── playwright.js
│   │   │   │   │   ├── screencast.js
│   │   │   │   │   ├── selectors.js
│   │   │   │   │   ├── stream.js
│   │   │   │   │   ├── timeoutSettings.js
│   │   │   │   │   ├── tracing.js
│   │   │   │   │   ├── types.js
│   │   │   │   │   ├── video.js
│   │   │   │   │   ├── waiter.js
│   │   │   │   │   ├── webError.js
│   │   │   │   │   ├── worker.js
│   │   │   │   │   └── writableStream.js
│   │   │   │   ├── generated
│   │   │   │   │   ├── bindingsControllerSource.js
│   │   │   │   │   ├── clockSource.js
│   │   │   │   │   ├── injectedScriptSource.js
│   │   │   │   │   ├── pollingRecorderSource.js
│   │   │   │   │   ├── storageScriptSource.js
│   │   │   │   │   ├── utilityScriptSource.js
│   │   │   │   │   └── webSocketMockSource.js
│   │   │   │   ├── protocol
│   │   │   │   │   ├── serializers.js
│   │   │   │   │   ├── validator.js
│   │   │   │   │   └── validatorPrimitives.js
│   │   │   │   ├── remote
│   │   │   │   │   ├── playwrightConnection.js
│   │   │   │   │   ├── playwrightPipeServer.js
│   │   │   │   │   ├── playwrightServer.js
│   │   │   │   │   ├── playwrightWebSocketServer.js
│   │   │   │   │   └── serverTransport.js
│   │   │   │   ├── server
│   │   │   │   │   ├── android
│   │   │   │   │   │   ├── android.js
│   │   │   │   │   │   └── backendAdb.js
│   │   │   │   │   ├── bidi
│   │   │   │   │   │   ├── third_party
│   │   │   │   │   │   │   ├── bidiCommands.d.js
│   │   │   │   │   │   │   ├── bidiKeyboard.js
│   │   │   │   │   │   │   ├── bidiProtocol.js
│   │   │   │   │   │   │   ├── bidiProtocolCore.js
│   │   │   │   │   │   │   ├── bidiProtocolPermissions.js
│   │   │   │   │   │   │   ├── bidiSerializer.js
│   │   │   │   │   │   │   └── firefoxPrefs.js
│   │   │   │   │   │   ├── bidiBrowser.js
│   │   │   │   │   │   ├── bidiChromium.js
│   │   │   │   │   │   ├── bidiConnection.js
│   │   │   │   │   │   ├── bidiDeserializer.js
│   │   │   │   │   │   ├── bidiExecutionContext.js
│   │   │   │   │   │   ├── bidiFirefox.js
│   │   │   │   │   │   ├── bidiInput.js
│   │   │   │   │   │   ├── bidiNetworkManager.js
│   │   │   │   │   │   ├── bidiOverCdp.js
│   │   │   │   │   │   ├── bidiPage.js
│   │   │   │   │   │   └── bidiPdf.js
│   │   │   │   │   ├── chromium
│   │   │   │   │   │   ├── chromium.js
│   │   │   │   │   │   ├── chromiumSwitches.js
│   │   │   │   │   │   ├── crBrowser.js
│   │   │   │   │   │   ├── crConnection.js
│   │   │   │   │   │   ├── crCoverage.js
│   │   │   │   │   │   ├── crDevTools.js
│   │   │   │   │   │   ├── crDragDrop.js
│   │   │   │   │   │   ├── crExecutionContext.js
│   │   │   │   │   │   ├── crInput.js
│   │   │   │   │   │   ├── crNetworkManager.js
│   │   │   │   │   │   ├── crPage.js
│   │   │   │   │   │   ├── crPdf.js
│   │   │   │   │   │   ├── crProtocolHelper.js
│   │   │   │   │   │   ├── crServiceWorker.js
│   │   │   │   │   │   ├── defaultFontFamilies.js
│   │   │   │   │   │   └── protocol.d.js
│   │   │   │   │   ├── codegen
│   │   │   │   │   │   ├── csharp.js
│   │   │   │   │   │   ├── java.js
│   │   │   │   │   │   ├── javascript.js
│   │   │   │   │   │   ├── jsonl.js
│   │   │   │   │   │   ├── language.js
│   │   │   │   │   │   ├── languages.js
│   │   │   │   │   │   ├── python.js
│   │   │   │   │   │   └── types.js
│   │   │   │   │   ├── dispatchers
│   │   │   │   │   │   ├── androidDispatcher.js
│   │   │   │   │   │   ├── artifactDispatcher.js
│   │   │   │   │   │   ├── browserContextDispatcher.js
│   │   │   │   │   │   ├── browserDispatcher.js
│   │   │   │   │   │   ├── browserTypeDispatcher.js
│   │   │   │   │   │   ├── cdpSessionDispatcher.js
│   │   │   │   │   │   ├── debugControllerDispatcher.js
│   │   │   │   │   │   ├── debuggerDispatcher.js
│   │   │   │   │   │   ├── dialogDispatcher.js
│   │   │   │   │   │   ├── dispatcher.js
│   │   │   │   │   │   ├── disposableDispatcher.js
│   │   │   │   │   │   ├── electronDispatcher.js
│   │   │   │   │   │   ├── elementHandlerDispatcher.js
│   │   │   │   │   │   ├── frameDispatcher.js
│   │   │   │   │   │   ├── jsHandleDispatcher.js
│   │   │   │   │   │   ├── jsonPipeDispatcher.js
│   │   │   │   │   │   ├── localUtilsDispatcher.js
│   │   │   │   │   │   ├── networkDispatchers.js
│   │   │   │   │   │   ├── pageDispatcher.js
│   │   │   │   │   │   ├── playwrightDispatcher.js
│   │   │   │   │   │   ├── streamDispatcher.js
│   │   │   │   │   │   ├── tracingDispatcher.js
│   │   │   │   │   │   ├── webSocketRouteDispatcher.js
│   │   │   │   │   │   └── writableStreamDispatcher.js
│   │   │   │   │   ├── electron
│   │   │   │   │   │   ├── electron.js
│   │   │   │   │   │   └── loader.js
│   │   │   │   │   ├── firefox
│   │   │   │   │   │   ├── ffBrowser.js
│   │   │   │   │   │   ├── ffConnection.js
│   │   │   │   │   │   ├── ffExecutionContext.js
│   │   │   │   │   │   ├── ffInput.js
│   │   │   │   │   │   ├── ffNetworkManager.js
│   │   │   │   │   │   ├── ffPage.js
│   │   │   │   │   │   ├── firefox.js
│   │   │   │   │   │   └── protocol.d.js
│   │   │   │   │   ├── har
│   │   │   │   │   │   ├── harRecorder.js
│   │   │   │   │   │   └── harTracer.js
│   │   │   │   │   ├── recorder
│   │   │   │   │   │   ├── chat.js
│   │   │   │   │   │   ├── recorderApp.js
│   │   │   │   │   │   ├── recorderRunner.js
│   │   │   │   │   │   ├── recorderSignalProcessor.js
│   │   │   │   │   │   ├── recorderUtils.js
│   │   │   │   │   │   └── throttledFile.js
│   │   │   │   │   ├── registry
│   │   │   │   │   │   ├── browserFetcher.js
│   │   │   │   │   │   ├── dependencies.js
│   │   │   │   │   │   ├── index.js
│   │   │   │   │   │   ├── nativeDeps.js
│   │   │   │   │   │   └── oopDownloadBrowserMain.js
│   │   │   │   │   ├── trace
│   │   │   │   │   │   ├── recorder
│   │   │   │   │   │   │   ├── snapshotter.js
│   │   │   │   │   │   │   ├── snapshotterInjected.js
│   │   │   │   │   │   │   └── tracing.js
│   │   │   │   │   │   └── viewer
│   │   │   │   │   │       └── traceViewer.js
│   │   │   │   │   ├── utils
│   │   │   │   │   │   ├── image_tools
│   │   │   │   │   │   │   ├── colorUtils.js
│   │   │   │   │   │   │   ├── compare.js
│   │   │   │   │   │   │   ├── imageChannel.js
│   │   │   │   │   │   │   └── stats.js
│   │   │   │   │   │   ├── ascii.js
│   │   │   │   │   │   ├── comparators.js
│   │   │   │   │   │   ├── crypto.js
│   │   │   │   │   │   ├── debug.js
│   │   │   │   │   │   ├── debugLogger.js
│   │   │   │   │   │   ├── disposable.js
│   │   │   │   │   │   ├── env.js
│   │   │   │   │   │   ├── eventsHelper.js
│   │   │   │   │   │   ├── expectUtils.js
│   │   │   │   │   │   ├── fileUtils.js
│   │   │   │   │   │   ├── happyEyeballs.js
│   │   │   │   │   │   ├── hostPlatform.js
│   │   │   │   │   │   ├── httpServer.js
│   │   │   │   │   │   ├── linuxUtils.js
│   │   │   │   │   │   ├── network.js
│   │   │   │   │   │   ├── nodePlatform.js
│   │   │   │   │   │   ├── pipeTransport.js
│   │   │   │   │   │   ├── processLauncher.js
│   │   │   │   │   │   ├── profiler.js
│   │   │   │   │   │   ├── socksProxy.js
│   │   │   │   │   │   ├── spawnAsync.js
│   │   │   │   │   │   ├── task.js
│   │   │   │   │   │   ├── userAgent.js
│   │   │   │   │   │   ├── wsServer.js
│   │   │   │   │   │   ├── zipFile.js
│   │   │   │   │   │   └── zones.js
│   │   │   │   │   ├── webkit
│   │   │   │   │   │   ├── protocol.d.js
│   │   │   │   │   │   ├── webkit.js
│   │   │   │   │   │   ├── wkBrowser.js
│   │   │   │   │   │   ├── wkConnection.js
│   │   │   │   │   │   ├── wkExecutionContext.js
│   │   │   │   │   │   ├── wkInput.js
│   │   │   │   │   │   ├── wkInterceptableRequest.js
│   │   │   │   │   │   ├── wkPage.js
│   │   │   │   │   │   ├── wkProvisionalPage.js
│   │   │   │   │   │   └── wkWorkers.js
│   │   │   │   │   ├── artifact.js
│   │   │   │   │   ├── browser.js
│   │   │   │   │   ├── browserContext.js
│   │   │   │   │   ├── browserType.js
│   │   │   │   │   ├── callLog.js
│   │   │   │   │   ├── clock.js
│   │   │   │   │   ├── console.js
│   │   │   │   │   ├── cookieStore.js
│   │   │   │   │   ├── debugController.js
│   │   │   │   │   ├── debugger.js
│   │   │   │   │   ├── deviceDescriptors.js
│   │   │   │   │   ├── deviceDescriptorsSource.json
│   │   │   │   │   ├── dialog.js
│   │   │   │   │   ├── disposable.js
│   │   │   │   │   ├── dom.js
│   │   │   │   │   ├── download.js
│   │   │   │   │   ├── errors.js
│   │   │   │   │   ├── fetch.js
│   │   │   │   │   ├── fileChooser.js
│   │   │   │   │   ├── fileUploadUtils.js
│   │   │   │   │   ├── formData.js
│   │   │   │   │   ├── frameSelectors.js
│   │   │   │   │   ├── frames.js
│   │   │   │   │   ├── harBackend.js
│   │   │   │   │   ├── helper.js
│   │   │   │   │   ├── index.js
│   │   │   │   │   ├── input.js
│   │   │   │   │   ├── instrumentation.js
│   │   │   │   │   ├── javascript.js
│   │   │   │   │   ├── launchApp.js
│   │   │   │   │   ├── localUtils.js
│   │   │   │   │   ├── macEditingCommands.js
│   │   │   │   │   ├── network.js
│   │   │   │   │   ├── overlay.js
│   │   │   │   │   ├── page.js
│   │   │   │   │   ├── pipeTransport.js
│   │   │   │   │   ├── playwright.js
│   │   │   │   │   ├── progress.js
│   │   │   │   │   ├── protocolError.js
│   │   │   │   │   ├── recorder.js
│   │   │   │   │   ├── screencast.js
│   │   │   │   │   ├── screenshotter.js
│   │   │   │   │   ├── selectors.js
│   │   │   │   │   ├── socksClientCertificatesInterceptor.js
│   │   │   │   │   ├── socksInterceptor.js
│   │   │   │   │   ├── transport.js
│   │   │   │   │   ├── types.js
│   │   │   │   │   ├── usKeyboardLayout.js
│   │   │   │   │   └── videoRecorder.js
│   │   │   │   ├── third_party
│   │   │   │   │   └── pixelmatch.js
│   │   │   │   ├── tools
│   │   │   │   │   ├── backend
│   │   │   │   │   │   ├── browserBackend.js
│   │   │   │   │   │   ├── common.js
│   │   │   │   │   │   ├── config.js
│   │   │   │   │   │   ├── console.js
│   │   │   │   │   │   ├── context.js
│   │   │   │   │   │   ├── cookies.js
│   │   │   │   │   │   ├── devtools.js
│   │   │   │   │   │   ├── dialogs.js
│   │   │   │   │   │   ├── evaluate.js
│   │   │   │   │   │   ├── files.js
│   │   │   │   │   │   ├── form.js
│   │   │   │   │   │   ├── keyboard.js
│   │   │   │   │   │   ├── logFile.js
│   │   │   │   │   │   ├── mouse.js
│   │   │   │   │   │   ├── navigate.js
│   │   │   │   │   │   ├── network.js
│   │   │   │   │   │   ├── pdf.js
│   │   │   │   │   │   ├── response.js
│   │   │   │   │   │   ├── route.js
│   │   │   │   │   │   ├── runCode.js
│   │   │   │   │   │   ├── screenshot.js
│   │   │   │   │   │   ├── sessionLog.js
│   │   │   │   │   │   ├── snapshot.js
│   │   │   │   │   │   ├── storage.js
│   │   │   │   │   │   ├── tab.js
│   │   │   │   │   │   ├── tabs.js
│   │   │   │   │   │   ├── tool.js
│   │   │   │   │   │   ├── tools.js
│   │   │   │   │   │   ├── tracing.js
│   │   │   │   │   │   ├── utils.js
│   │   │   │   │   │   ├── verify.js
│   │   │   │   │   │   ├── video.js
│   │   │   │   │   │   ├── wait.js
│   │   │   │   │   │   └── webstorage.js
│   │   │   │   │   ├── cli-client
│   │   │   │   │   │   ├── skill
│   │   │   │   │   │   │   ├── references
│   │   │   │   │   │   │   │   ├── element-attributes.md
│   │   │   │   │   │   │   │   ├── playwright-tests.md
│   │   │   │   │   │   │   │   ├── request-mocking.md
│   │   │   │   │   │   │   │   ├── running-code.md
│   │   │   │   │   │   │   │   ├── session-management.md
│   │   │   │   │   │   │   │   ├── storage-state.md
│   │   │   │   │   │   │   │   ├── test-generation.md
│   │   │   │   │   │   │   │   ├── tracing.md
│   │   │   │   │   │   │   │   └── video-recording.md
│   │   │   │   │   │   │   └── SKILL.md
│   │   │   │   │   │   ├── cli.js
│   │   │   │   │   │   ├── help.json
│   │   │   │   │   │   ├── minimist.js
│   │   │   │   │   │   ├── program.js
│   │   │   │   │   │   ├── registry.js
│   │   │   │   │   │   └── session.js
│   │   │   │   │   ├── cli-daemon
│   │   │   │   │   │   ├── command.js
│   │   │   │   │   │   ├── commands.js
│   │   │   │   │   │   ├── daemon.js
│   │   │   │   │   │   ├── helpGenerator.js
│   │   │   │   │   │   └── program.js
│   │   │   │   │   ├── dashboard
│   │   │   │   │   │   ├── dashboardApp.js
│   │   │   │   │   │   └── dashboardController.js
│   │   │   │   │   ├── mcp
│   │   │   │   │   │   ├── browserFactory.js
│   │   │   │   │   │   ├── cdpRelay.js
│   │   │   │   │   │   ├── cli-stub.js
│   │   │   │   │   │   ├── config.d.js
│   │   │   │   │   │   ├── config.js
│   │   │   │   │   │   ├── configIni.js
│   │   │   │   │   │   ├── extensionContextFactory.js
│   │   │   │   │   │   ├── index.js
│   │   │   │   │   │   ├── log.js
│   │   │   │   │   │   ├── program.js
│   │   │   │   │   │   ├── protocol.js
│   │   │   │   │   │   └── watchdog.js
│   │   │   │   │   ├── trace
│   │   │   │   │   │   ├── SKILL.md
│   │   │   │   │   │   ├── installSkill.js
│   │   │   │   │   │   ├── traceActions.js
│   │   │   │   │   │   ├── traceAttachments.js
│   │   │   │   │   │   ├── traceCli.js
│   │   │   │   │   │   ├── traceConsole.js
│   │   │   │   │   │   ├── traceErrors.js
│   │   │   │   │   │   ├── traceOpen.js
│   │   │   │   │   │   ├── traceParser.js
│   │   │   │   │   │   ├── traceRequests.js
│   │   │   │   │   │   ├── traceScreenshot.js
│   │   │   │   │   │   ├── traceSnapshot.js
│   │   │   │   │   │   └── traceUtils.js
│   │   │   │   │   ├── utils
│   │   │   │   │   │   ├── mcp
│   │   │   │   │   │   │   ├── http.js
│   │   │   │   │   │   │   ├── server.js
│   │   │   │   │   │   │   └── tool.js
│   │   │   │   │   │   ├── connect.js
│   │   │   │   │   │   └── socketConnection.js
│   │   │   │   │   └── exports.js
│   │   │   │   ├── utils
│   │   │   │   │   └── isomorphic
│   │   │   │   │       ├── trace
│   │   │   │   │       │   ├── versions
│   │   │   │   │       │   │   ├── traceV3.js
│   │   │   │   │       │   │   ├── traceV4.js
│   │   │   │   │       │   │   ├── traceV5.js
│   │   │   │   │       │   │   ├── traceV6.js
│   │   │   │   │       │   │   ├── traceV7.js
│   │   │   │   │       │   │   └── traceV8.js
│   │   │   │   │       │   ├── entries.js
│   │   │   │   │       │   ├── snapshotRenderer.js
│   │   │   │   │       │   ├── snapshotServer.js
│   │   │   │   │       │   ├── snapshotStorage.js
│   │   │   │   │       │   ├── traceLoader.js
│   │   │   │   │       │   ├── traceModel.js
│   │   │   │   │       │   ├── traceModernizer.js
│   │   │   │   │       │   └── traceUtils.js
│   │   │   │   │       ├── ariaSnapshot.js
│   │   │   │   │       ├── assert.js
│   │   │   │   │       ├── colors.js
│   │   │   │   │       ├── cssParser.js
│   │   │   │   │       ├── cssTokenizer.js
│   │   │   │   │       ├── formatUtils.js
│   │   │   │   │       ├── headers.js
│   │   │   │   │       ├── imageUtils.js
│   │   │   │   │       ├── jsonSchema.js
│   │   │   │   │       ├── locatorGenerators.js
│   │   │   │   │       ├── locatorParser.js
│   │   │   │   │       ├── locatorUtils.js
│   │   │   │   │       ├── lruCache.js
│   │   │   │   │       ├── manualPromise.js
│   │   │   │   │       ├── mimeType.js
│   │   │   │   │       ├── multimap.js
│   │   │   │   │       ├── protocolFormatter.js
│   │   │   │   │       ├── protocolMetainfo.js
│   │   │   │   │       ├── rtti.js
│   │   │   │   │       ├── selectorParser.js
│   │   │   │   │       ├── semaphore.js
│   │   │   │   │       ├── stackTrace.js
│   │   │   │   │       ├── stringUtils.js
│   │   │   │   │       ├── time.js
│   │   │   │   │       ├── timeoutRunner.js
│   │   │   │   │       ├── types.js
│   │   │   │   │       ├── urlMatch.js
│   │   │   │   │       ├── utilityScriptSerializers.js
│   │   │   │   │       └── yaml.js
│   │   │   │   ├── utilsBundleImpl
│   │   │   │   │   ├── index.js
│   │   │   │   │   └── xdg-open
│   │   │   │   ├── vite
│   │   │   │   │   ├── dashboard
│   │   │   │   │   │   ├── assets
│   │   │   │   │   │   │   ├── index-BAOybkp8.js
│   │   │   │   │   │   │   └── index-CZAYOG76.css
│   │   │   │   │   │   └── index.html
│   │   │   │   │   ├── htmlReport
│   │   │   │   │   │   ├── index.html
│   │   │   │   │   │   ├── report.css
│   │   │   │   │   │   └── report.js
│   │   │   │   │   ├── recorder
│   │   │   │   │   │   ├── assets
│   │   │   │   │   │   │   ├── codeMirrorModule-C8KMvO9L.js
│   │   │   │   │   │   │   ├── codeMirrorModule-DYBRYzYX.css
│   │   │   │   │   │   │   ├── codicon-DCmgc-ay.ttf
│   │   │   │   │   │   │   ├── index-BSjZa4pk.css
│   │   │   │   │   │   │   └── index-CqAYX1I3.js
│   │   │   │   │   │   ├── index.html
│   │   │   │   │   │   └── playwright-logo.svg
│   │   │   │   │   └── traceViewer
│   │   │   │   │       ├── assets
│   │   │   │   │       │   ├── codeMirrorModule-DS0FLvoc.js
│   │   │   │   │       │   ├── defaultSettingsView-GTWI-W_B.js
│   │   │   │   │       │   └── xtermModule-CsJ4vdCR.js
│   │   │   │   │       ├── codeMirrorModule.DYBRYzYX.css
│   │   │   │   │       ├── codicon.DCmgc-ay.ttf
│   │   │   │   │       ├── defaultSettingsView.B4dS75f0.css
│   │   │   │   │       ├── index.C5466mMT.js
│   │   │   │   │       ├── index.CzXZzn5A.css
│   │   │   │   │       ├── index.html
│   │   │   │   │       ├── manifest.webmanifest
│   │   │   │   │       ├── playwright-logo.svg
│   │   │   │   │       ├── snapshot.html
│   │   │   │   │       ├── sw.bundle.js
│   │   │   │   │       ├── uiMode.Btcz36p_.css
│   │   │   │   │       ├── uiMode.Vipi55dB.js
│   │   │   │   │       ├── uiMode.html
│   │   │   │   │       └── xtermModule.DYP7pi_n.css
│   │   │   │   ├── androidServerImpl.js
│   │   │   │   ├── bootstrap.js
│   │   │   │   ├── browserServerImpl.js
│   │   │   │   ├── inProcessFactory.js
│   │   │   │   ├── inprocess.js
│   │   │   │   ├── mcpBundle.js
│   │   │   │   ├── mcpBundleImpl.js
│   │   │   │   ├── outofprocess.js
│   │   │   │   ├── serverRegistry.js
│   │   │   │   ├── utils.js
│   │   │   │   ├── utilsBundle.js
│   │   │   │   ├── zipBundle.js
│   │   │   │   ├── zipBundleImpl.js
│   │   │   │   ├── zodBundle.js
│   │   │   │   └── zodBundleImpl.js
│   │   │   ├── types
│   │   │   │   ├── protocol.d.ts
│   │   │   │   ├── structs.d.ts
│   │   │   │   └── types.d.ts
│   │   │   ├── LICENSE
│   │   │   ├── NOTICE
│   │   │   ├── README.md
│   │   │   ├── ThirdPartyNotices.txt
│   │   │   ├── browsers.json
│   │   │   ├── cli.js
│   │   │   ├── index.d.ts
│   │   │   ├── index.js
│   │   │   ├── index.mjs
│   │   │   └── package.json
│   │   └── .package-lock.json
│   ├── videos
│   │   ├── page@0b7fdcaec428918ef7a0d87d394051f9.webm
│   │   └── page@134bf6c4007c78f16acd0d0d3c853db0.webm
│   ├── package-lock.json
│   ├── package.json
│   └── record_observer.js
├── claude
│   ├── skills
│   │   └── integration-javascript_node
│   │       ├── references
│   │       │   ├── basic-integration-1.0-begin.md
│   │       │   ├── basic-integration-1.1-edit.md
│   │       │   ├── basic-integration-1.2-revise.md
│   │       │   ├── basic-integration-1.3-conclude.md
│   │       │   ├── identify-users.md
│   │       │   ├── node.md
│   │       │   └── posthog-node.md
│   │       └── SKILL.md
│   ├── launch.json
│   └── settings.local.json
├── content
│   ├── canada.html
│   ├── comms.html
│   ├── esm.html
│   ├── ground-ops.html
│   ├── mission.html
│   ├── orion.html
│   ├── science.html
│   └── sls.html
├── css
│   └── styles.css
├── data
│   ├── skyfield-data
│   │   └── de440s.bsp
│   ├── .DS_Store
│   ├── Artemis_II_OEM_2026_04_03_to_EI-1.asc
│   ├── Artemis_II_OEM_2026_04_04_to_EI.asc
│   ├── Artemis_II_OEM_latest.asc
│   ├── artemis2_oem.asc
│   ├── astronomy.js
│   ├── flyby-animation-data.json
│   ├── flyby-lighting.json
│   ├── generate_ephemeris.py
│   ├── mission-ephemeris.json
│   ├── observer-horizons.json
│   ├── osculating-elements.json
│   ├── parse_oem.py
│   ├── trajectory.json
│   └── update_ephemeris.js
├── docs
│   ├── a2-reference-guide-012825.pdf
│   └── file-structure.md
├── js
│   ├── .DS_Store
│   ├── apollo-model.js
│   ├── clock.js
│   ├── crew-activity-ui.js
│   ├── crew-activity.js
│   ├── crew.js
│   ├── dsn.js
│   ├── flyby-lighting.js
│   ├── iss-model.js
│   ├── mission-ephemeris.js
│   ├── mission-events.js
│   ├── news.js
│   ├── observer-astro.js
│   ├── observer-horizons.js
│   ├── observer-ui.js
│   ├── orion-model.js
│   ├── osculating-orbit.js
│   ├── reference.js
│   ├── shared.js
│   ├── stats.js
│   ├── timeline.js
│   ├── trajectory.js
│   ├── ui.js
│   └── weather.js
├── min
│   ├── css
│   │   └── styles.css
│   ├── data
│   │   └── mission-ephemeris.json
│   └── js
│       ├── apollo-model.js
│       ├── clock.js
│       ├── crew.js
│       ├── dsn.js
│       ├── iss-model.js
│       ├── mission-ephemeris.js
│       ├── mission-events.js
│       ├── news.js
│       ├── observer-astro.js
│       ├── observer-ui.js
│       ├── orion-model.js
│       ├── reference.js
│       ├── shared.js
│       ├── stats.js
│       ├── timeline.js
│       ├── trajectory.js
│       ├── ui.js
│       └── weather.js
├── scripts
│   └── minify-assets.mjs
├── CLAUDE.md
├── DS_Store
├── agents
├── artemis-ephemeris-check.json
├── cursor
├── cursorignore
├── env
├── flyby.html
├── img
├── index.html
├── llms-full.txt
├── llms.txt
├── manifest.json
├── observer.html
├── package-lock.json
├── package.json
├── posthog-setup-report.md
├── robots.txt
├── service-worker.js
├── sitemap.xml
├── spec-flyby-moonview.md
├── spec-flyby-page.md
├── spec-osculating-orbit.md
└── vercel.json
```
