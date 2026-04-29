# Changelog

## [1.17.0](https://github.com/runloopai/rl-cli/compare/v1.16.0...v1.17.0) (2026-04-29)


### Features

* add --public flag to agent create, fix object upload --public ([#219](https://github.com/runloopai/rl-cli/issues/219)) ([6e7a8b3](https://github.com/runloopai/rl-cli/commit/6e7a8b32ecc30590ddfef39987df46d310766cde))
* agent object picker, multi-mount support, and TUI improvements ([#217](https://github.com/runloopai/rl-cli/issues/217)) ([dbe2a5c](https://github.com/runloopai/rl-cli/commit/dbe2a5c753553db454492fc4f2a964c24b7b6818))
* support multi-path tar/tgz archive creation in obj upload ([#220](https://github.com/runloopai/rl-cli/issues/220)) ([3528701](https://github.com/runloopai/rl-cli/commit/3528701120b7da27c64c5982bf6b3706d0a19518))


### Bug Fixes

* menu header clipping and breadcrumb hyperlink ([#221](https://github.com/runloopai/rl-cli/issues/221)) ([3ef6271](https://github.com/runloopai/rl-cli/commit/3ef62719d6d3e5928b6a679b17ef0f2bee26f30a))

## [1.16.0](https://github.com/runloopai/rl-cli/compare/v1.15.0...v1.16.0) (2026-04-23)


### Features

* add agent/axon TUI screens and align list commands with pagination ([#205](https://github.com/runloopai/rl-cli/issues/205)) ([1481d7a](https://github.com/runloopai/rl-cli/commit/1481d7ab0e242ce773678989672465dfc4a1917d))
* add secret config to bmj, toggle available to show public benchmarks for new jobs ([#156](https://github.com/runloopai/rl-cli/issues/156)) ([86cda21](https://github.com/runloopai/rl-cli/commit/86cda217a6534a1313696654414ad1da00c034cf))
* better handling of RUNLOOP_BASE_URL ([#216](https://github.com/runloopai/rl-cli/issues/216)) ([f4b59fd](https://github.com/runloopai/rl-cli/commit/f4b59fd66884df62ac35a9cd3e04afb89db088ed))
* extract shared object detail fields and fix ResourcePicker height ([#204](https://github.com/runloopai/rl-cli/issues/204)) ([b685b65](https://github.com/runloopai/rl-cli/commit/b685b6559247f38b5e245b660862f6b0db914cb5))
* improve agent support in interactive rli ([#209](https://github.com/runloopai/rl-cli/issues/209)) ([4aa5ca6](https://github.com/runloopai/rl-cli/commit/4aa5ca6df143214cafcd2ffbda633d21640a5817))
* update agents support in rli command line ([#200](https://github.com/runloopai/rl-cli/issues/200)) ([512d41f](https://github.com/runloopai/rl-cli/commit/512d41f2211ee608772c34426428fb1dff8a5a87))


### Bug Fixes

* "Showing 1-0 of 0" in TUI, cache unfiltered total count through search reset ([#196](https://github.com/runloopai/rl-cli/issues/196)) ([8170888](https://github.com/runloopai/rl-cli/commit/8170888a2372943fc2a75bda3a850b39b046dd63))
* don't reset settings TUI menu cursor on back ([#198](https://github.com/runloopai/rl-cli/issues/198)) ([7a0796d](https://github.com/runloopai/rl-cli/commit/7a0796d42359060f1e380fdaa0cf2afea8a8661c))
* harden dependency security posture ([#211](https://github.com/runloopai/rl-cli/issues/211)) ([198ad1e](https://github.com/runloopai/rl-cli/commit/198ad1e014702bcbf3b3fe6a2ecf9554fda53d2e))
* improve column width handling for rli agent list ([#199](https://github.com/runloopai/rl-cli/issues/199)) ([d4aa73f](https://github.com/runloopai/rl-cli/commit/d4aa73faf9f9120a9ef29637d431487e062fe25e))

## [1.15.0](https://github.com/runloopai/rl-cli/compare/v1.14.0...v1.15.0) (2026-04-03)


### Features

* axon list with pagination and api-client upgrade ([#184](https://github.com/runloopai/rl-cli/issues/184)) ([dc9743e](https://github.com/runloopai/rl-cli/commit/dc9743e1000cfcf6de5602bd9eed197baba63d28))
* **cli:** add some (hidden) agent handling commands ([#187](https://github.com/runloopai/rl-cli/issues/187)) ([1a92f5f](https://github.com/runloopai/rl-cli/commit/1a92f5f6888b5eb22a45c7813450e697311ccae4))


### Bug Fixes

* clean stdout for --config-only when appending SSH config ([#192](https://github.com/runloopai/rl-cli/issues/192)) ([4428295](https://github.com/runloopai/rl-cli/commit/4428295516407978c40ab65174a939e9fa23c855))
* **cli:** account for pending scenarios in rli display ([#185](https://github.com/runloopai/rl-cli/issues/185)) ([c82d528](https://github.com/runloopai/rl-cli/commit/c82d528e3028b4c6eaf7fb30d868c80e91edbf91))
* widen VERSION column in agent list to prevent truncation ([#190](https://github.com/runloopai/rl-cli/issues/190)) ([c7eba09](https://github.com/runloopai/rl-cli/commit/c7eba095443f63a4256ea403d72554135fbc3a3c))


### Performance Improvements

* fetch total count in the background, not foreground ([#189](https://github.com/runloopai/rl-cli/issues/189)) ([0903d89](https://github.com/runloopai/rl-cli/commit/0903d89b57f36e715025ef73132b0616c05c753f))

## [1.14.0](https://github.com/runloopai/rl-cli/compare/v1.13.3...v1.14.0) (2026-03-25)


### Features

* add 'logs' command to download info from devboxes ([#164](https://github.com/runloopai/rl-cli/issues/164)) ([d5354be](https://github.com/runloopai/rl-cli/commit/d5354bedaecc68faf44e7c4063d2f76a4b57c808))
* use total_count field from Pagination API response ([#175](https://github.com/runloopai/rl-cli/issues/175)) ([4e84f30](https://github.com/runloopai/rl-cli/commit/4e84f3024d5281cc33a54cd6299ef2fc7fc77ecf))


### Bug Fixes

* **benchmark:** fix benchmark id when creating job with benchmark ([#170](https://github.com/runloopai/rl-cli/issues/170)) ([2c73cba](https://github.com/runloopai/rl-cli/commit/2c73cbadf74d4d5cf9f8532111147654587822e1))
* bmj list now counts finished scenarios from in-progress runs ([#168](https://github.com/runloopai/rl-cli/issues/168)) ([123f1d4](https://github.com/runloopai/rl-cli/commit/123f1d44f846da67ac2e31478fe4e1316f58991b))
* **cli:** show failure reason when benchmark job fails with no outcomes ([#182](https://github.com/runloopai/rl-cli/issues/182)) ([817b5cd](https://github.com/runloopai/rl-cli/commit/817b5cd36dc3f10ed5f2fa9c3af8b7aefcf5a9a1))
* **cli:** use allSettled() instead of all() so one bad download doesn't spoil the barrel ([#178](https://github.com/runloopai/rl-cli/issues/178)) ([8f4145a](https://github.com/runloopai/rl-cli/commit/8f4145a356f3899fb651518591f1fd3652bc2dec))
* don't reset TUI menu cursor on back ([#181](https://github.com/runloopai/rl-cli/issues/181)) ([6cc35a7](https://github.com/runloopai/rl-cli/commit/6cc35a7fdd9b947d0921bb973f0137ed26dfd4ce))
* eliminate flicker in bmj watch and show job elapsed time ([#167](https://github.com/runloopai/rl-cli/issues/167)) ([9b1deed](https://github.com/runloopai/rl-cli/commit/9b1deedf0d495b0a2651ec912a18fa8c7e9c1a7c))
* prevent double devbox creation when pressing Enter in interactive form ([#173](https://github.com/runloopai/rl-cli/issues/173)) ([23f8a28](https://github.com/runloopai/rl-cli/commit/23f8a282e3184fdfb4253868e698676dd352671f))
* scenarios sometimes listed as in progress after bmj completes ([#174](https://github.com/runloopai/rl-cli/issues/174)) ([78f8f55](https://github.com/runloopai/rl-cli/commit/78f8f5533a8d0f9a2d546323b28b7244aff4c32a))
* update broken tests ([#169](https://github.com/runloopai/rl-cli/issues/169)) ([d8b35a2](https://github.com/runloopai/rl-cli/commit/d8b35a2b4c22cf8422e240bbcf067a97b7944cd0))


### Performance Improvements

* **cli:** parallelize scenario log downloads with max concurrency of 50 ([#176](https://github.com/runloopai/rl-cli/issues/176)) ([a5828a2](https://github.com/runloopai/rl-cli/commit/a5828a286eff127d00e119b633aa357aed24700c))
* **cli:** parallelize scenario run fetching and name resolution in bmj logs ([#179](https://github.com/runloopai/rl-cli/issues/179)) ([227d0fd](https://github.com/runloopai/rl-cli/commit/227d0fd607ad5d5a1f188cae246d3d1d8587e714))

## [1.13.3](https://github.com/runloopai/rl-cli/compare/v1.13.2...v1.13.3) (2026-03-09)


### Bug Fixes

* **benchmark:** set default agent timeout -&gt; 2 hours ([#162](https://github.com/runloopai/rl-cli/issues/162)) ([869fb89](https://github.com/runloopai/rl-cli/commit/869fb8956d975a1e88c27bd7d7b664162ac6d64f))

## [1.13.2](https://github.com/runloopai/rl-cli/compare/v1.13.1...v1.13.2) (2026-03-09)


### Bug Fixes

* **benchmark:** increase id column so full id visible in bechmark-job.list ([#159](https://github.com/runloopai/rl-cli/issues/159)) ([a472f0a](https://github.com/runloopai/rl-cli/commit/a472f0a07dd5d1c275e5e79cfeead08ab6f97fae))
* **benchmark:** remove default agent timeout ([#160](https://github.com/runloopai/rl-cli/issues/160)) ([97fcfcc](https://github.com/runloopai/rl-cli/commit/97fcfcc7c51808bf751a607cfee03ba80e906a70))

## [1.13.1](https://github.com/runloopai/rl-cli/compare/v1.13.0...v1.13.1) (2026-03-07)


### Bug Fixes

* disable unfinished benchmark features in interactive UX ([#157](https://github.com/runloopai/rl-cli/issues/157)) ([fd84d31](https://github.com/runloopai/rl-cli/commit/fd84d31617e112cae0774625691327cefdc443a8))

## [1.13.0](https://github.com/runloopai/rl-cli/compare/v1.12.0...v1.13.0) (2026-03-06)


### Features

* add benchmark list features ([#154](https://github.com/runloopai/rl-cli/issues/154)) ([2abe85c](https://github.com/runloopai/rl-cli/commit/2abe85c2cd0ffa901107673b6effd5d49afefaf9))
* **benchmark:** add status breakout during status -w ([#149](https://github.com/runloopai/rl-cli/issues/149)) ([393548e](https://github.com/runloopai/rl-cli/commit/393548eb8611fa302183264b4b055cf18a17a09f))
* **benchmark:** add watch with term takeover / interactive display ([#151](https://github.com/runloopai/rl-cli/issues/151)) ([c49ee7a](https://github.com/runloopai/rl-cli/commit/c49ee7ae578d6131c2bfceb491e439250ec60948))
* **benchmark:** print scenario runtime, status and prompt for viewing extended ([#152](https://github.com/runloopai/rl-cli/issues/152)) ([32f4f72](https://github.com/runloopai/rl-cli/commit/32f4f7234fbb14c848c515898d26519872020e61))
* **benchmark:** support multi agent jobs ([#145](https://github.com/runloopai/rl-cli/issues/145)) ([41ec8d3](https://github.com/runloopai/rl-cli/commit/41ec8d38ed1a1cb293a5b8f720fbf6cabdcba169))


### Bug Fixes

* remove spurious warning for optional secrets ([#146](https://github.com/runloopai/rl-cli/issues/146)) ([3abea8a](https://github.com/runloopai/rl-cli/commit/3abea8afd7bf8241541dc534c0bae6329a1083a5))

## [1.12.0](https://github.com/runloopai/rl-cli/compare/v1.11.2...v1.12.0) (2026-03-05)


### Features

* **benchmark:** add benchmark job run, status ([#142](https://github.com/runloopai/rl-cli/issues/142)) ([80e26c1](https://github.com/runloopai/rl-cli/commit/80e26c175465b2f44bbd776a89e78a68393e1ae7))
* **blueprint:** support blueprint create metadata ([#141](https://github.com/runloopai/rl-cli/issues/141)) ([4579d91](https://github.com/runloopai/rl-cli/commit/4579d91a6dffa54f1dc11af72841556d7b3888e3))
* **cli:** add llms.txt ([#139](https://github.com/runloopai/rl-cli/issues/139)) ([db21f81](https://github.com/runloopai/rl-cli/commit/db21f814cedd63b5b3980403d83ec6b5a8ad13a0))


### Bug Fixes

* using the new format for mcp-configs ([#132](https://github.com/runloopai/rl-cli/issues/132)) ([9deeb1c](https://github.com/runloopai/rl-cli/commit/9deeb1ce507eaa94b7104c865cbb2c570c32d3b3))

## [1.11.2](https://github.com/runloopai/rl-cli/compare/v1.11.1...v1.11.2) (2026-02-26)


### Bug Fixes

* network policy create toggles and detail page for egress rules ([#129](https://github.com/runloopai/rl-cli/issues/129)) ([3e37035](https://github.com/runloopai/rl-cli/commit/3e37035d337a78b5c905836bfd6ac825ce0c3230))

## [1.11.1](https://github.com/runloopai/rl-cli/compare/v1.11.0...v1.11.1) (2026-02-26)


### Bug Fixes

* cli commands for mcp configs ([#125](https://github.com/runloopai/rl-cli/issues/125)) ([f5b655c](https://github.com/runloopai/rl-cli/commit/f5b655c06ebf069039d21bb02dbecdf9c74b3686))
* rename ai gateway ([#127](https://github.com/runloopai/rl-cli/issues/127)) ([3017c5f](https://github.com/runloopai/rl-cli/commit/3017c5fad03d428b119672e59b86c0c591a8dde6))
* update for network policy field name change ([#128](https://github.com/runloopai/rl-cli/issues/128)) ([e8c2f98](https://github.com/runloopai/rl-cli/commit/e8c2f98dde98e37239ce1d1c271a4e870a686ac8))

## [1.11.0](https://github.com/runloopai/rl-cli/compare/v1.10.0...v1.11.0) (2026-02-26)


### Features

* add model name config in Benchmark Jobs ([#118](https://github.com/runloopai/rl-cli/issues/118)) ([08a67c7](https://github.com/runloopai/rl-cli/commit/08a67c760515aae5f06652fedaa84554cea44485))
* **devbox:** add mcp hub to cli ([#124](https://github.com/runloopai/rl-cli/issues/124)) ([02a1b5e](https://github.com/runloopai/rl-cli/commit/02a1b5e42361b1df91ef43a74bdd7a0ee1c3eee0))
* network policy create flags ([#123](https://github.com/runloopai/rl-cli/issues/123)) ([8419b69](https://github.com/runloopai/rl-cli/commit/8419b6924c22370914043bd32b0eff67e7f9a359))


### Bug Fixes

* bug with detail page stale data ([#120](https://github.com/runloopai/rl-cli/issues/120)) ([148a7bc](https://github.com/runloopai/rl-cli/commit/148a7bc053d443226d94ba238fcd3f8988d31628))
* detail pages sections for large things on small screens ([#122](https://github.com/runloopai/rl-cli/issues/122)) ([059673a](https://github.com/runloopai/rl-cli/commit/059673aa80a39061c7f86bd81524e8af991de754))
* unified polling hook ([#121](https://github.com/runloopai/rl-cli/issues/121)) ([f014f2d](https://github.com/runloopai/rl-cli/commit/f014f2d18175c4c39fa8c4578628dbfd08888f41))

## [1.10.0](https://github.com/runloopai/rl-cli/compare/v1.9.0...v1.10.0) (2026-02-14)


### Features

* **devbox:** allow tunnel config interactive, show tunnel in info ([#102](https://github.com/runloopai/rl-cli/issues/102)) ([7f073d4](https://github.com/runloopai/rl-cli/commit/7f073d412bf3ba855500e743dd72e9db80cdbfa9))


### Bug Fixes

* **devbox:** scp command improved to allow for src or dest to be devboxes ([#109](https://github.com/runloopai/rl-cli/issues/109)) ([5c9b884](https://github.com/runloopai/rl-cli/commit/5c9b88490cf61e8e4e4d9e1c2d6be37882d51c06))
* gateway cli improvements ([#113](https://github.com/runloopai/rl-cli/issues/113)) ([ad33a02](https://github.com/runloopai/rl-cli/commit/ad33a0276a2954c6c0edc4ab7f076047d530ae5d))

## [1.9.0](https://github.com/runloopai/rl-cli/compare/v1.8.0...v1.9.0) (2026-02-10)


### Features

* add benchmark job to cli [beta]  ([#88](https://github.com/runloopai/rl-cli/issues/88)) ([f8759c2](https://github.com/runloopai/rl-cli/commit/f8759c2d67283730369cc110fab46b098513ca1d))
* add gatway support to rli ([#101](https://github.com/runloopai/rl-cli/issues/101)) ([441e888](https://github.com/runloopai/rl-cli/commit/441e8887e69ddee64bd49d09e5062b366600dff3))
* adding links to detail pages IE: allowing you to view the source of a devbox ([#112](https://github.com/runloopai/rl-cli/issues/112)) ([62fa6dc](https://github.com/runloopai/rl-cli/commit/62fa6dccfe28d9c8c730817a9b1530d7065b605b))
* **devbox:** add tunnel to devbox create ([#99](https://github.com/runloopai/rl-cli/issues/99)) ([a3c1b7a](https://github.com/runloopai/rl-cli/commit/a3c1b7a3f9013970273c2724fa8b38e32062bf8f))
* **snapshot:** snapshot prune command ([#104](https://github.com/runloopai/rl-cli/issues/104)) ([b3479fe](https://github.com/runloopai/rl-cli/commit/b3479febb985f89ca1fdbdd672facb46e3af75be))


### Bug Fixes

* **benchmark:** scenario status in run view and some additional tweaks ([#98](https://github.com/runloopai/rl-cli/issues/98)) ([ca77634](https://github.com/runloopai/rl-cli/commit/ca77634bbfbb6b94326be76193a9a1de51017eeb))
* **blueprint:** adding delete ([#111](https://github.com/runloopai/rl-cli/issues/111)) ([0658932](https://github.com/runloopai/rl-cli/commit/0658932a340b4c6268bf74ea6afca51276c130d8))
* **blueprint:** handled blueprint queued state ([#100](https://github.com/runloopai/rl-cli/issues/100)) ([a77e558](https://github.com/runloopai/rl-cli/commit/a77e558dfd51164e3ebe1df0abb9c0a0d273aab9))
* **devbox:** gateway config create bug ([#110](https://github.com/runloopai/rl-cli/issues/110)) ([6e7e8c4](https://github.com/runloopai/rl-cli/commit/6e7e8c4f7a23b3e5192330ec02bfda529f17b836))
* **secret:** obscure secret value entry within tui ([#86](https://github.com/runloopai/rl-cli/issues/86)) ([8697e5c](https://github.com/runloopai/rl-cli/commit/8697e5c94d6f24af00c02e2f9a09af32c3c3b35a))
* upgrades a dependency with an override ([#94](https://github.com/runloopai/rl-cli/issues/94)) ([c7f9398](https://github.com/runloopai/rl-cli/commit/c7f93983c1b944aa30b50922707a03b762430668))

## [1.8.0](https://github.com/runloopai/rl-cli/compare/v1.7.1...v1.8.0) (2026-01-28)


### Features

* adding secrets and reorganizing main menu to have a settings page ([#81](https://github.com/runloopai/rl-cli/issues/81)) ([69aa213](https://github.com/runloopai/rl-cli/commit/69aa213ce556799a949eb4f10f66b9cf239c7ee4))
* **benchmark:** adding benchmark runs and scenarios to the cli ([#84](https://github.com/runloopai/rl-cli/issues/84)) ([bda1e91](https://github.com/runloopai/rl-cli/commit/bda1e9105480bbd1ff7525fed9e0373829dc4cf6))

## [1.7.1](https://github.com/runloopai/rl-cli/compare/v1.7.0...v1.7.1) (2026-01-27)


### Bug Fixes

* **devbox:** fixed log flashing on some terminals ([#78](https://github.com/runloopai/rl-cli/issues/78)) ([8107796](https://github.com/runloopai/rl-cli/commit/81077960c928c5d2c2e623c342242f3882fb0bfb))

## [1.7.0](https://github.com/runloopai/rl-cli/compare/v1.6.0...v1.7.0) (2026-01-26)


### Features

* **devbox:** add streaming exec viewer with kill support and terminal resize stability ([#77](https://github.com/runloopai/rl-cli/issues/77)) ([7cc315b](https://github.com/runloopai/rl-cli/commit/7cc315b1bf4df17bb6b0c6cc73f73a07082ada8c))


### Bug Fixes

* **snapshot:** improvements to snapshot UI ([#75](https://github.com/runloopai/rl-cli/issues/75)) ([b04fc98](https://github.com/runloopai/rl-cli/commit/b04fc9898fb94262ea299b0b0fd62e814e60d70c))

## [1.6.0](https://github.com/runloopai/rl-cli/compare/v1.5.0...v1.6.0) (2026-01-24)


### Features

* add standardized search to all table views ([#72](https://github.com/runloopai/rl-cli/issues/72)) ([9fa6eaa](https://github.com/runloopai/rl-cli/commit/9fa6eaaa04a36805d0687b31597d04a230847475))

## [1.5.0](https://github.com/runloopai/rl-cli/compare/v1.4.1...v1.5.0) (2026-01-24)


### Features

* add secret crud to rli ([#71](https://github.com/runloopai/rl-cli/issues/71)) ([8970eb7](https://github.com/runloopai/rl-cli/commit/8970eb7f51060bad68dce3bf6a1269757ffd6a88))

## [1.4.1](https://github.com/runloopai/rl-cli/compare/v1.4.0...v1.4.1) (2026-01-23)


### Bug Fixes

* small screen handling across the application, especially log viewing issues ([#60](https://github.com/runloopai/rl-cli/issues/60)) ([d06e101](https://github.com/runloopai/rl-cli/commit/d06e1012c927e0f502b17be55c0bd77413984fb7))

## [1.4.0](https://github.com/runloopai/rl-cli/compare/v1.3.0...v1.4.0) (2026-01-23)


### Features

* **blueprint:** from dockerfile support for rli ([#59](https://github.com/runloopai/rl-cli/issues/59)) ([b7eef5d](https://github.com/runloopai/rl-cli/commit/b7eef5db8ab849933b08776d5453f96da2c558dc))


### Bug Fixes

* **blueprint:** showing blueprint failure reason in detail page ([#55](https://github.com/runloopai/rl-cli/issues/55)) ([0352649](https://github.com/runloopai/rl-cli/commit/0352649ade4bcf8298195286532fffca8962cb3a))
* create screens now allow enter to trigger the create ([#57](https://github.com/runloopai/rl-cli/issues/57)) ([f2a872e](https://github.com/runloopai/rl-cli/commit/f2a872eee5fcac55d86bba262ee8246135ced9e9))
* resovled red flash bug during navigation ([#58](https://github.com/runloopai/rl-cli/issues/58)) ([9e003f9](https://github.com/runloopai/rl-cli/commit/9e003f9f0b116307288fa933a12a31d4e29cd682))

## [1.3.0](https://github.com/runloopai/rl-cli/compare/v1.2.0...v1.3.0) (2026-01-23)


### Features

* add rainbow shimmer animation ([#52](https://github.com/runloopai/rl-cli/issues/52)) ([b4c9ccb](https://github.com/runloopai/rl-cli/commit/b4c9ccb22fe7a825d8557ccbcf28a2f0b3e2c5f7))
* added management for network-policies, storage-objects with layout and screen size improvements ([#54](https://github.com/runloopai/rl-cli/issues/54)) ([138aed3](https://github.com/runloopai/rl-cli/commit/138aed3e785f909f2a39704de141081ec129ebc8))

## [1.2.0](https://github.com/runloopai/rl-cli/compare/v1.1.0...v1.2.0) (2026-01-17)


### Features

* **blueprint:** add prune command ([#47](https://github.com/runloopai/rl-cli/issues/47)) ([96be7fa](https://github.com/runloopai/rl-cli/commit/96be7fa1cc73330addc9c10f76d6f43140761d66))

## [1.1.0](https://github.com/runloopai/rl-cli/compare/v1.0.0...v1.1.0) (2026-01-16)


### Features

* control d now exits the rli process ([#45](https://github.com/runloopai/rl-cli/issues/45)) ([bf77722](https://github.com/runloopai/rl-cli/commit/bf7772206f8f000444c49d352937d85fc702a6d3))

## [1.0.0](https://github.com/runloopai/rl-cli/compare/v0.10.0...v1.0.0) (2026-01-14)


### ⚠ BREAKING CHANGES

* added documentation and more gif videos of the cli in action ([#43](https://github.com/runloopai/rl-cli/issues/43))

### Features

* added documentation and more gif videos of the cli in action ([#43](https://github.com/runloopai/rl-cli/issues/43)) ([83609ba](https://github.com/runloopai/rl-cli/commit/83609ba56c71b8882d21707b41bec45f2382029e))

## [0.10.0](https://github.com/runloopai/rl-cli/compare/v0.9.0...v0.10.0) (2026-01-13)


### Features

* **devbox:** style improvements ([#36](https://github.com/runloopai/rl-cli/issues/36)) ([4563c19](https://github.com/runloopai/rl-cli/commit/4563c1981e01ffa046639d8880e88a7f55fdda77))


### Bug Fixes

* **devbox:** devbox correctly renders metadata without the header ([#38](https://github.com/runloopai/rl-cli/issues/38)) ([88c9c7c](https://github.com/runloopai/rl-cli/commit/88c9c7cde23a5eb8352c1f8f118baceba427ed45))

## [0.9.0](https://github.com/runloopai/rl-cli/compare/v0.8.0...v0.9.0) (2026-01-08)


### Features

* **devbox:** added state transition display to detail page ([#34](https://github.com/runloopai/rl-cli/issues/34)) ([80ad621](https://github.com/runloopai/rl-cli/commit/80ad621930bd1174cd395476a4cd6148848f792c))

## [0.8.0](https://github.com/runloopai/rl-cli/compare/v0.7.0...v0.8.0) (2026-01-08)


### Features

* prepared repo for open source contributions! ([#29](https://github.com/runloopai/rl-cli/issues/29)) ([a6d91c5](https://github.com/runloopai/rl-cli/commit/a6d91c5d4bf8bd737e7bdcec41991e0b817f3f3d))

## [0.7.0](https://github.com/runloopai/rl-cli-node/compare/v0.6.1...v0.7.0) (2026-01-08)


### Features

* **blueprint:** automatically navigate to new devbox created from blueprint list page ([#18](https://github.com/runloopai/rl-cli-node/issues/18)) ([0c76cc0](https://github.com/runloopai/rl-cli-node/commit/0c76cc0f24c439837bfc474c71f13853b607a81f))
* cli can update itself when prompted ([#21](https://github.com/runloopai/rl-cli-node/issues/21)) ([fe584de](https://github.com/runloopai/rl-cli-node/commit/fe584de75c3921c418c00b9e074e21842fcdd0ba))
* **devbox:** navigates to devbox detail after create  ([#22](https://github.com/runloopai/rl-cli-node/issues/22)) ([731681f](https://github.com/runloopai/rl-cli-node/commit/731681f3fbd63fb4cabbeb7cd32439aa8fc488c6))
* **snapshot:** snapshot list view actions now allows for devbox creation from snapshot ([#15](https://github.com/runloopai/rl-cli-node/issues/15)) ([19c5382](https://github.com/runloopai/rl-cli-node/commit/19c53829218cbdeedf7486fc28a43f5e98efe335))


### Bug Fixes

* update repo info ([#25](https://github.com/runloopai/rl-cli-node/issues/25)) ([1db1235](https://github.com/runloopai/rl-cli-node/commit/1db1235f8281256b5793af7a81994d289f97c4e2))

## [0.6.1](https://github.com/runloopai/rl-cli-node/compare/v0.6.0...v0.6.1) (2026-01-08)


### Bug Fixes

* update repo info ([#25](https://github.com/runloopai/rl-cli-node/issues/25)) ([1db1235](https://github.com/runloopai/rl-cli-node/commit/1db1235f8281256b5793af7a81994d289f97c4e2))

## [0.6.0](https://github.com/runloopai/rl-cli-node/compare/v0.5.0...v0.6.0) (2026-01-08)


### Features

* **devbox:** navigates to devbox detail after create  ([#22](https://github.com/runloopai/rl-cli-node/issues/22)) ([731681f](https://github.com/runloopai/rl-cli-node/commit/731681f3fbd63fb4cabbeb7cd32439aa8fc488c6))

## [0.5.0](https://github.com/runloopai/rl-cli-node/compare/v0.4.0...v0.5.0) (2026-01-08)


### Features

* **blueprint:** automatically navigate to new devbox created from blueprint list page ([#18](https://github.com/runloopai/rl-cli-node/issues/18)) ([0c76cc0](https://github.com/runloopai/rl-cli-node/commit/0c76cc0f24c439837bfc474c71f13853b607a81f))
* cli can update itself when prompted ([#21](https://github.com/runloopai/rl-cli-node/issues/21)) ([fe584de](https://github.com/runloopai/rl-cli-node/commit/fe584de75c3921c418c00b9e074e21842fcdd0ba))
* **snapshot:** snapshot list view actions now allows for devbox creation from snapshot ([#15](https://github.com/runloopai/rl-cli-node/issues/15)) ([19c5382](https://github.com/runloopai/rl-cli-node/commit/19c53829218cbdeedf7486fc28a43f5e98efe335))
