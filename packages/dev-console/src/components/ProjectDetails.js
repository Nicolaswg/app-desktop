import React, { useState, useEffect, useReducer } from "react";

import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Flex,
  Text,
  Button,
  Image,
  Link,
  Divider,
  Input,
  Radio,
  TextArea,
  useTheme,
} from "@blend-ui/core";

import { Tabs, Tab, TabList, TabPanel, TabPanelList } from "@blend-ui/tabs";

import { TagInput } from "@blend-ui/tag-input";

import {
  updateAppVersionMutation,
  deleteAppVersionMutation,
  listDataSourcesQuery,
  i18n,
  getAppVersionQuery,
  useAppContext,
  //checkUrl
} from "@prifina-apps/utils";

import { API as GRAPHQL, Storage } from "aws-amplify";

import config from "../config";

import PropTypes from "prop-types";
import { BlendIcon } from "@blend-ui/icons";

import * as C from "./components";

import { useToast } from "@blend-ui/toast";

import styled from "styled-components";

import mdiArrowLeft from "@iconify/icons-mdi/arrow-left";
import hazardSymbol from "@iconify/icons-mdi/warning";
import successTick from "@iconify/icons-mdi/tick-circle";

import UploadAsset from "./UploadAsset";
import UploadFile from "./UploadFile";

import {
  AddRemoveDataSources,
  ControlAddedDataSources,
  DataSourceForm,
  ApiForm,
} from "./helper";

const ImageZoomContainer = styled(Image)`
  transition: transform 0.2s;

  height: 142px;
  &:hover {
    transform: scale(1.5, 1.5);
  }
  cursor: pointer;
`;

const ImageZoom = ({ src }) => {
  console.log("ZOOM IMAGE ", src)
  return (
    <ImageZoomContainer
      src={src}
      height="150px"
      onError={e => (e.target.style.display = "none")}
      onClick={() => {
        window.open(src);
      }}
    />
  );
};

ImageZoom.propTypes = {
  src: PropTypes.string,
};


const userRegion = config.cognito.USER_IDENTITY_POOL_ID.split(":")[0];

Storage.configure({
  bucket: `prifina-data-${config.prifinaAccountId}-${config.main_region}`,
  region: userRegion,
});


const getImage = (s3Key) => {

  console.log("GET IMAGE URL ", s3Key);
  return new Promise(function (resolve, reject) {
    Storage.get(s3Key, { level: "public", download: false })
      .then(url => {
        var myRequest = new Request(url);
        fetch(myRequest).then(function (response) {
          if (response.status === 200) {
            console.log("URL ", url);
            resolve(url);
          } else {
            reject(response.status);
          }
        });
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
  });
};

const listAssets = (s3Key) => {
  console.log("S3 ", s3Key);

  return Storage.list(s3Key, { level: "public", });

}

const ProjectDetails = (props) => {

  console.log("DETAILS ", props);
  const { colors } = useTheme();
  //console.log("THEME COLORS  ", colors);
  //const history = useHistory();
  const navigate = useNavigate();

  const { appID } = props;

  const { currentUser } = useAppContext();

  const toast = useToast();

  const [appData, setAppData] = useState();

  const [isLoading, setIsLoading] = useState(true);

  const [newValues, setNewValues] = useState();

  const [newKeyFeatures, setNewKeyFeatures] = useState([]);
  const [newUserHeld, setNewUserHeld] = useState([]);
  const [newUserGenerated, setNewUserGenerated] = useState([]);
  const [newPublic, setNewPublic] = useState([]);

  //in progress..
  const [isEqual, setIsEqual] = useState(false);

  const [activeTab, setActiveTab] = useState(0);

  const tabClick3 = (e, tab) => {
    setActiveTab(tab);
  };

  //const [assetsS3Path, setAssetsS3Path] = useState("");

  const assetsS3Path = `https://prifina-data-${config.prifinaAccountId}-${config.main_region}.s3.${config.main_region}.amazonaws.com/public/${appID}/assets`;

  //const [assetStatuses, setAssetStatus] = useState([]);

  // can't use object/array for controlling state change reloading...
  // this method allows to "pack" those state variables into one state
  // replace this later with zustand... 
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    {

      icon: false,
      screenShot1: false,
      screenShot2: false,
      screenShot3: false
    });

  const [imageUrls, setImageUrl] = useState(new Array(4).fill(""));

  const [newDataSources, setNewDataSources] = useState([]);
  console.log("new data sources", newDataSources);

  let defaultSettings = [
    {
      field: "sizes",
      value: '[{"option":"300x300","value":"300x300"}]',
      label: "Sizes",
      type: "select",
    },
    {
      field: "theme",
      value: '[{"option":"Light","value":"light"}]',
      label: "Theme",
      type: "select",
    },
  ];

  useEffect(() => {
    async function fetchData() {
      const result = await getAppVersionQuery(GRAPHQL, appID);
      const currentApp = result.data.getAppVersion;
      console.log("filtered app", currentApp);
      delete currentApp.modifiedAt;
      delete currentApp.createdAt;

      // note currentApp.version should not be updated.... nextVersion instead.

      // noSQL doesn't have all attributes, which are in schema object, if those attributes doesn't have values... 
      if (!currentApp?.icon) {
        currentApp.icon = "";
      }
      if (!currentApp?.screenshots) {
        currentApp.screenshots = new Array(3).fill("");
      }
      // native assets...
      if (!currentApp?.assets) {
        currentApp.assets = [];
      }

      setAppData(currentApp);

      setNewValues(currentApp);

      setNewKeyFeatures(
        currentApp.keyFeatures === null ? [] : currentApp.keyFeatures,
      );
      setNewUserHeld(currentApp.userHeld === null ? [] : currentApp.userHeld);
      setNewUserGenerated(
        currentApp.userGenerated === null ? [] : currentApp.userGenerated,
      );
      setNewPublic(currentApp.public === null ? [] : currentApp.public);

      if (currentApp?.dataSources && currentApp.dataSources != null && currentApp.dataSources.length > 0) {
        console.log("DATASOURCES FOUND ", currentApp.dataSources, typeof currentApp.dataSources);
        setNewDataSources(JSON.parse(currentApp.dataSources));
      }


      const assetList = await listAssets(appID + "/assets/");
      //      console.log("PROCESS THIS ", assetList);
      if (assetList.length > 0) {
        const statuses = new Array(4).fill(false);
        const checkList = ["icon-1.png",
          "screenshot-1.png",
          "screenshot-2.png",
          "screenshot-3.png"];
        let images = [];
        assetList.forEach(asset => {
          const assetKey = asset.key.split("/").pop();
          const idx = checkList.indexOf(assetKey);
          if (idx > -1) {
            statuses[idx] = true;
            images.push(getImage(appID + "/assets/" + assetKey));
          }
        })

        await Promise.all(images).then(res => {
          //console.log("URLS ", res);
          let urls = imageUrls;
          res.forEach(url => {
            checkList.forEach((img, i) => {
              if (url.indexOf(img) > -1) {
                urls[i] = url;
              }
            });
          });
          console.log("ASSETS STATUS ", urls, statuses, assetList)

          setState({ icon: statuses[0], screenShot1: statuses[1], screenShot2: statuses[2], screenShot3: statuses[3] })
          setImageUrl(urls);
        })
        /*
        await Promise.all(images).then(urls=>{
  
          let urls = imageUrls;
          urls[idx] = url;
          setImageUrl(urls);
      
        }) 
     
      */

        /* 
         const images = ['icon-1.png', 'screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png'];
 
 
         getImage(appID + "/assets/" + images[idx], (url) => {
           let urls = imageUrls;
           urls[idx] = url;
           setImageUrl(urls);
 */
        // console.log("STATUSES ", statuses, assetList);

      }
      setIsLoading(false);

    }
    fetchData();
  }, []);

  console.log("appData", appData);

  console.log("USER HELD", newUserHeld);

  console.log("KEY FEATURES", newKeyFeatures);

  //in progress..
  // useEffect(() => {
  //   let eq = JSON.stringify(newValues) === JSON.stringify(appData);
  //   console.log("eq", eq);

  //   if (eq) {
  //     setIsEqual(true);
  //   } else if (!eq) {
  //     setIsEqual(false);
  //   }
  // }, [newValues]);

  const handleValueChange = event => {
    let value = event.target.value;
    let name = event.target.name;

    setNewValues(prevalue => {
      return {
        ...prevalue, // Spread Operator
        [name]: value,
      };
    });
  };

  console.log("NEW VALUES", newValues);

  const saveChanges = (
    id,
    appType,
    name,
    nextVersion,
    publisher,
    newCategory,
    deviceSupport,
    languages,
    age,
    newKeyFeatures,
    shortDescription,
    longDescription,
    newUserHeld,
    newUserGenerated,
    newPublic,
    icon,
    screenshots,
    newRemoteUrl,
    newDataSources,
  ) => {
    updateAppVersionMutation(GRAPHQL, {
      id: id,
      appType: appType,
      name: name,
      nextVersion: nextVersion,
      publisher: publisher,
      category: newCategory,
      deviceSupport: deviceSupport,
      languages: languages,
      age: age,
      keyFeatures: newKeyFeatures,
      shortDescription: shortDescription,
      longDescription: longDescription,
      userHeld: newUserHeld,
      userGenerated: newUserGenerated,
      public: newPublic,
      icon: icon,
      screenshots: screenshots,
      remoteUrl: newRemoteUrl,
      dataSources: JSON.stringify(newDataSources),
      settings: defaultSettings,
    }).then(res => {
      console.log("SUCCESS", res);
      toast.success("Project details updated", {});
      // location.reload();
      //   setStep(2);
    });
  };

  const publishApp = () => {
    updateAppVersionMutation(GRAPHQL, {
      id: newValues.id,
      status: 1,
    }).then(res => {
      console.log("SUCCESS", res);
      setNewValues({ ...newValues });
      toast.success("Your project has been published", {});
      // location.reload();
      //   setStep(2);
    });
  };

  const deleteApp = () => {
    deleteAppVersionMutation(GRAPHQL, newValues.id).then(res => {
      console.log("SUCCESS", res);
      // location.reload();
      toast.success("Deleted project", {});
    });
  };

  const detailsSaveStatus = () => {
    if (!isEqual) {
      return (
        <Flex alignItems="center">
          <BlendIcon
            size="18px"
            iconify={hazardSymbol}
            className="icon"
            color="orange"
          />
          <Text fontSize="xs" ml={5} color="#EDA436">
            Unsaved Changes
          </Text>
          <Button
            ml="15px"
            onClick={() => {
              saveChanges(
                newValues.id,
                newValues.appType,
                newValues.name,
                newValues.nextVersion,
                newValues.publisher,
                newValues.category,
                newValues.deviceSupport,
                newValues.languages,
                newValues.age,
                newKeyFeatures,
                newValues.shortDescription,
                newValues.longDescription,
                newUserHeld,
                newUserGenerated,
                newPublic,
                newValues.icon,
                newValues.screenshots,
                newValues.newRemoteUrl,
                newDataSources,
              );
            }}
          >
            Save Changes
          </Button>
        </Flex>
      );
    } else {
      return (
        <Flex alignItems="center">
          <Text fontSize="xs">No Unsaved Changes</Text>
          <Button disabled colorStyle="red" ml="15px">
            Save Changes
          </Button>
        </Flex>
      );
    }
  };

  // const passAssetInfo = title => {
  //   console.log("pass", title);

  //   setNewValues({
  //     ...newValues,
  //     icon: appData.id + "-" + "icon" + "-" + title,
  //   });
  // };

  //---------------------------------------------------------

  const [dataConnectors, setDataConnectors] = useState([]);
  const [publicSources, setPublicSources] = useState([]);

  useEffect(() => {
    // declare the async data fetching function
    const fetchConnectors = async () => {
      const data = await listDataSourcesQuery(GRAPHQL, {
        filter: { sourceType: { lt: 3 } },
      });
      let filteredData = data.data.listDataSources.items;

      console.log("original data sources", filteredData);

      setDataConnectors(filteredData);
    };
    const fetchPublic = async () => {
      const data = await listDataSourcesQuery(GRAPHQL, {
        filter: { sourceType: { eq: 3 } },
      });
      let filteredData = data.data.listDataSources.items;

      console.log("original public", filteredData);

      setPublicSources(filteredData);
    };

    // call the function
    fetchConnectors().catch(console.error);
    fetchPublic().catch(console.error);
  }, []);

  const [dataSourcePreview, setDataSourcePreview] = useState([]);
  const [apiDataPreview, setApiDataPreview] = useState([]);

  console.log("CLOUD DATA", dataSourcePreview);
  console.log("API DATA", apiDataPreview);

  let addedDataSources = dataSourcePreview
    .concat(apiDataPreview)
    .filter(key => key.isAdded == true);
  console.log("ADDED DATA", addedDataSources);

  const [editControled, setEditControled] = useState(false);

  ///Prifina user cloud
  //can make them reusable
  const addDataSource = (source, sourceType) => {
    const newSourceData = [...dataSourcePreview, { source, sourceType }];
    console.log("NEW DATASOURCE ADDED ", newSourceData);
    setDataSourcePreview(newSourceData);
  };

  const removeDataSource = index => {
    const newSourceData = [...dataSourcePreview];
    newSourceData.splice(index, 1);
    setDataSourcePreview(newSourceData);
  };

  const completeDataSource = index => {
    console.log("COMPLETE DATA SOURCE CLICK ", dataSourcePreview);
    const newSourceData = newDataSources.concat(dataSourcePreview);
    setNewDataSources(newSourceData);
  };

  //////API

  const addApiSource = text => {
    const newSourceData = [...apiDataPreview, { text }];
    setApiDataPreview(newSourceData);
  };

  const removeApiSource = index => {
    const newSourceData = [...apiDataPreview];
    newSourceData.splice(index, 1);
    setApiDataPreview(newSourceData);
  };

  const completeApiSource = index => {
    const newSourceData = [...apiDataPreview];
    newSourceData[index].isAdded = true;
    setNewDataSources(newSourceData);
  };

  const uncompleteDataSource = index => {
    newDataSources.splice(index, 1);
    setNewDataSources([...newDataSources]);
  };

  //==============//==============//==============//==============//==============//==============//==============

  // /changing attribute name
  dataConnectors.forEach(function (obj) {
    obj.value = obj.name;
  });
  publicSources.forEach(function (obj) {
    obj.value = obj.name;
  });

  function checkJson(str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  const [fontColor, setFontColor] = useState(colors.textMuted);

  const handleFocusColor = () => {
    setFontColor(colors.brandAccent);
  };
  const handleBlurColor = () => {
    setFontColor(colors.textMuted);
  };

  const updateAssetStatus = (status, idx) => {
    // 
    const keys = Object.keys(state);
    //console.log(keys, keys[idx]);
    //{status:false,url:""},
    //{`${assetsS3Path}/icon-1.png`}
    console.log("ASSET UPLOAD ", idx);
    const images = ['icon-1.png', 'screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png'];
    getImage(appID + "/assets/" + images[idx]).then(url => {
      //console.log("UPDATE ASSET ", url);
      let urls = imageUrls;
      urls[idx] = url;
      setImageUrl(urls);
      setState({ [keys[idx]]: status });
      let name = "icon";
      let asset = "icon-1.png";
      if (idx != 0) {
        name = 'screenshots';
        const currentScreenShots = newValues.screenshots;
        currentScreenShots[idx - 1] = images[idx];
        asset = currentScreenShots;
      }
      console.log("UPDATE VALUES ", name, asset)
      setNewValues(existing => {
        return {
          ...existing,
          [name]: asset,
        };
      });
    })


  }

  return (
    <>
      {!isLoading ? (
        <Flex flexDirection="column">
          <C.ActionContainer
            mt={10}
            mb={24}
            style={{
              top: 65,
              position: "sticky",
              boxShadow: `0px 15px 20px ${colors.basePrimary}`,
            }}
          >
            <C.CustomShape bg="brandAccent" />
            <BlendIcon
              style={{ cursor: "pointer" }}
              color={colors.textPrimary}
              iconify={mdiArrowLeft}
              width="24px"
              onClick={() => {
                navigate(-1);
              }}
            />
            <Input
              width="200px"
              name="name"
              defaultValue={appData.name}
              onChange={handleValueChange}
            />
            <Flex>

              <Flex flexDirection="row" alignItems="center" mr="20px">
                <Flex flexDirection="row" alignItems="center" mr="15px">
                  <Radio
                    fontSize="8px"
                    onChange={() => { }}
                    onClick={() => {
                      setNewValues((existing) => { return { ...existing, appType: 1 } });
                    }}
                    checked={newValues.appType === 1 ? "checked" : null}
                  />
                  <Text fontSize="xs">{i18n.__("application")}</Text>
                </Flex>
                <Flex flexDirection="row" alignItems="center">
                  <Radio
                    fontSize="10px"
                    onChange={() => { }}

                    onClick={() => {
                      setNewValues((existing) => { return { ...existing, appType: 2 } });
                      //setNewValues({ ...newValues, appType: 2 });
                    }}
                    checked={newValues.appType === 2 ? "checked" : null}
                  />
                  <Text fontSize="xs">{i18n.__("widget")}</Text>
                </Flex>
              </Flex>

              {detailsSaveStatus()}
            </Flex>
            <Button
              onClick={() => {
                navigate("/sandbox", { state: { allValues: appData } });
              }}
            >
              Launch Sandbox
            </Button>
          </C.ActionContainer>
          <C.ProjectContainer mb={24}>
            <Flex justifyContent="space-between" alignItems="center">
              <Text style={{ textTransform: "uppercase" }}>
                Project resources
              </Text>
            </Flex>
            <Box width="584px">
              <Text fontSize="xs">
                Add your .Zip build deployment package and information regarding
                your apps data useage here to prepare for handoff to a nominated
                publisher account.
              </Text>
            </Box>
            <Divider mb={24} mt={24} color={colors.textMuted} />
            <Text mb={24}>Build deployment</Text>

            <Flex mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  App ID
                </Text>
                <Input
                  disabled
                  width="451px"
                  label="text"
                  value={appData.id}
                  color={colors.textPrimary}
                  style={{ background: "transparent" }}
                />
              </Box>
            </Flex>
            <Box mb={16}>
              <Text fontSize="sm" mb={5}>
                Version number
              </Text>
              <Flex alignItems="center">
                <Input
                  onFocus={handleFocusColor}
                  onBlur={handleBlurColor}
                  label="text"
                  name="nextVersion"
                  defaultValue={appData.nextVersion || "undefined"}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                  style={{
                    background: "transparent",
                    minWidth: "451px",
                    width: 451,
                  }}
                />
                <Text fontSize="xs" ml={25} color={fontColor}>
                  This version number is for your internal use so can follow
                  whatever logic you choose.
                </Text>
              </Flex>
            </Box>

            <Flex alignItems="center" justifyContent="center" mb={16}>
              <Box ml="5px">
                <Text fontSize="sm" mb={5}>
                  Build deployment package
                </Text>

                <UploadFile widgetId={appID} />
              </Box>
              <Box ml={25}>
                <Text fontSize="xs" color={colors.textMuted}>
                  The build deployment package is a package version of your
                  local build. It must include:
                </Text>
                <Text fontSize="xs" color={colors.textMuted}>
                  1. Your Prifina App ID
                </Text>
                <Text fontSize="xs" color={colors.textMuted}>
                  2. Come in a .zip with a maximum file size of 5MB
                </Text>
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Remote Link
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="newRemoteUrl"
                  defaultValue={appData.remoteUrl}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Native Assets
                </Text>
              </Box>
              <UploadAsset variant="native" id={appData.id} onFinish={() => {

              }} />
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Publisher
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="publisher"
                  defaultValue={appData.publisher}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Category
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="category"
                  defaultValue={appData.category}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Short Description
                </Text>
                <TextArea
                  expand
                  height={50}
                  width="451px"
                  label="text"
                  name="shortDescription"
                  defaultValue={appData.shortDescription}
                  onChange={handleValueChange}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Long Description
                </Text>
                <TextArea
                  expand
                  height={100}
                  width="451px"
                  label="text"
                  name="longDescription"
                  defaultValue={appData.longDescription}
                  onChange={handleValueChange}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Key Features
                </Text>
                <TagInput
                  tags={newKeyFeatures}
                  setTags={setNewKeyFeatures}
                  style={{
                    background: colors.baseTertiary,
                  }}
                />
              </Box>
            </Flex>

            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  User Held
                </Text>
                <TagInput
                  tags={newUserHeld}
                  setTags={setNewUserHeld}
                  style={{ backgroundColor: colors.baseTertiary }}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  User Generated
                </Text>
                <TagInput
                  tags={newUserGenerated}
                  setTags={setNewUserGenerated}
                  style={{ backgroundColor: colors.baseTertiary }}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Public
                </Text>
                <TagInput
                  tags={newPublic}
                  setTags={setNewPublic}
                  style={{ backgroundColor: colors.baseTertiary }}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Device support
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="deviceSupport"
                  defaultValue={appData.deviceSupport}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Languages
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="languages"
                  defaultValue={appData.languages}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Age
                </Text>
                <Input
                  width="451px"
                  label="text"
                  name="age"
                  defaultValue={appData.age}
                  onChange={handleValueChange}
                  color={colors.textPrimary}
                />
              </Box>
            </Flex>
            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Icon
                </Text>
              </Box>

              <UploadAsset
                id={appData.id}
                type="icon"
                numId="1"
                onFinish={updateAssetStatus}

              // passAssetInfo={passAssetInfo}
              />
            </Flex>

            {state.icon &&
              <Image
                src={imageUrls[0]}
                onError={e => (e.target.style.display = "none")}
              />
            }

            <Flex alignItems="flex-end" mb={16}>
              <Box>
                <Text fontSize="sm" mb={5}>
                  Screenshot
                </Text>
              </Box>
              <UploadAsset
                id={appData.id}
                type="screenshot"
                numId="1"
                onFinish={updateAssetStatus}
              // passAssetInfo={passAssetInfo}
              />
              <UploadAsset
                id={appData.id}
                type="screenshot"
                numId="2"
                onFinish={updateAssetStatus}
              // passAssetInfo={passAssetInfo}
              />
              <UploadAsset
                id={appData.id}
                type="screenshot"
                numId="3"
                onFinish={updateAssetStatus}
              // passAssetInfo={passAssetInfo}
              />
            </Flex>
            <Flex width="700px" justifyContent="space-between">
              {state.screenShot1 &&
                <ImageZoom
                  src={imageUrls[1]}
                  onError={e => (e.target.style.display = "none")}
                />
              }

              {state.screenShot2 &&
                <ImageZoom
                  src={imageUrls[2]}
                  onError={e => (e.target.style.display = "none")}
                />
              }
              {state.screenShot3 &&
                <ImageZoom
                  src={imageUrls[3]}
                  onError={e => (e.target.style.display = "none")}
                />
              }
            </Flex>
          </C.ProjectContainer>
          <C.ProjectContainer alt="dataSources" mb={24}>
            <Flex justifyContent="space-between" alignItems="center" mb={45}>
              <Text style={{ textTransform: "uppercase" }}>Data sources</Text>
            </Flex>
            <Flex>
              <div
                style={{
                  overflow: "hidden",
                  width: 600,
                }}
              >
                <Tabs
                  activeTab={activeTab}
                  onClick={tabClick3}
                  style={{
                    height: "100%",
                    background: "transparent",
                    padding: 0,
                  }}
                  variant="rectangle"
                >
                  <TabList>
                    <Tab>
                      <Text>{i18n.__("publicApi")}</Text>
                    </Tab>
                    <Tab>
                      <Text>{i18n.__("prifinaUserCloud")}</Text>
                    </Tab>
                    <Tab>
                      <Text>{i18n.__("noData")}</Text>
                    </Tab>
                  </TabList>
                  <TabPanelList style={{ backgroundColor: null }}>
                    <TabPanel
                      style={{
                        height: "100vh",
                        paddingBottom: "50px",
                        overflow: "auto",
                      }}
                    >
                      <div style={{ overflow: "auto" }}>
                        <Flex>
                          <ApiForm
                            addApi={addApiSource}
                            selectOptions={publicSources}
                          />
                        </Flex>

                        {/* Box with state change */}
                        <Flex>
                          {apiDataPreview.length > 0 && (
                            <Flex
                              width="100%"
                              flexDirection="column"
                              padding="10px"
                              style={{
                                marginTop: 15,
                                borderRadius: 10,
                              }}
                            >
                              <Text textStyle="h6" mb="10px">
                                {i18n.__("chooseToAddSources")}
                              </Text>
                              <Flex>
                                <Flex flexDirection="column">
                                  {apiDataPreview.map((event, index) => (
                                    <AddRemoveDataSources
                                      key={index}
                                      index={index}
                                      dataSource={event}
                                      removeDataSource={removeApiSource}
                                      completeDataSource={completeApiSource}
                                    />
                                  ))}
                                </Flex>
                              </Flex>
                            </Flex>
                          )}
                        </Flex>
                      </div>
                    </TabPanel>
                    <TabPanel>
                      <div style={{ overflow: "auto" }}>
                        <Flex>
                          <DataSourceForm
                            addDataSource={addDataSource}
                            // addFunctions={addFunction}
                            selectOptions={dataConnectors}
                          />
                        </Flex>
                        <Flex>
                          {dataSourcePreview.length > 0 && (
                            <Flex
                              width="100%"
                              flexDirection="column"
                              padding="10px"
                              style={{
                                backgroundColor: colors.baseMuted,
                                marginTop: 15,
                                borderRadius: 10,
                              }}
                            >
                              <Text textStyle="h6" mt="10px" mb="10px">
                                {i18n.__("dataConectorResults")}
                              </Text>

                              <Flex>
                                <Flex flexDirection="column">
                                  {dataSourcePreview.map((item, index) => (
                                    <>
                                      <AddRemoveDataSources
                                        key={index}
                                        index={index}
                                        dataSource={item}
                                        removeDataSource={removeDataSource}
                                        completeDataSource={completeDataSource}
                                      />
                                    </>
                                  ))}
                                </Flex>
                              </Flex>
                            </Flex>
                          )}
                        </Flex>
                      </div>
                    </TabPanel>
                    <TabPanel>
                      <div style={{ overflow: "auto" }}>
                        <Flex>
                          <Box
                            width="426px"
                            height="76px"
                            borderRadius="6px"
                            paddingLeft="10px"
                            bg={colors.baseLinkHover}
                            style={{
                              border: `2px solid ${colors.baseLink}`,
                            }}
                          >
                            <Flex>
                              <Text>{i18n.__("noDataText")}</Text>
                              <Button
                                variation="link"
                                onClick={() => {
                                  window.open("https://prifina.com");
                                }}
                              >
                                {i18n.__("learnMoreHere")}
                              </Button>
                            </Flex>
                          </Box>

                          <Flex ml="10px">{/* <CheckboxStateful /> */}</Flex>
                        </Flex>
                      </div>
                    </TabPanel>
                  </TabPanelList>
                </Tabs>
              </div>
              <Box width="320px">
                <Text fontSize="13px">
                  Let us know how your application uses data by logging your
                  sources (or lack of) here.
                </Text>
                <Text mt="15px" fontSize="13px">
                  This information helps us provide quality support and helps
                  direct our product roadmap.
                </Text>
              </Box>
            </Flex>

            {appData.dataSources !== null &&
              appData.dataSources !== "[]" &&
              appData.dataSources !== 0 &&
              appData.dataSources !== ["[null]"] ? (
              <Flex flexDirection="column" justifyContent="center">

                {newDataSources.length > 0 && newDataSources.map((item, index) => (
                  <ControlAddedDataSources
                    key={index}
                    keyIndex={index}
                    dataSource={item}
                    uncompleteDataSource={uncompleteDataSource}
                    editControled={editControled}
                  />
                ))}

                {newDataSources.length === 0 && <div>No datasources </div>}
              </Flex>
            ) : (
              <Flex flexDirection="column" justifyContent="center">
                <Text mt="20px" mb="20px">
                  Data sources used in your project
                </Text>
                <Flex
                  style={{
                    border: "1px dashed #BC31EA",
                    width: 684,
                    height: 132,
                    borderRadius: 4,
                    background: "#F7DEFF",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text fontSize="lg" color="#BC31EA">
                    Search and select data sources
                  </Text>
                  <Text mt="10px" color="#BC31EA">
                    Data sources you add will show up here
                  </Text>
                </Flex>
              </Flex>
            )}
          </C.ProjectContainer>

          <C.ActionContainer mb={32} justifyContent="space-between">
            <C.CustomShape bg="baseError" />
            <Box width="530px">
              <Text>PUBLISH PROJECT</Text>
              <Text mt={5} fontSize="xs">
                Your App Status is -{" "}
                {appData.status === 1 ? "Published" : "Not Published"}
              </Text>
            </Box>
            <Button
              onClick={publishApp}
              disabled={appData.status === 1 ? true : false}
            >
              Publish
            </Button>
          </C.ActionContainer>

          <C.ActionContainer mb={32} justifyContent="space-between">
            <C.CustomShape bg="baseError" />
            <Box width="530px">
              <Text>DELETE PROJECT</Text>
              <Text mt={5} fontSize="xs">
                Choose this to delete your project and all data associated with
                your account. This operation is final and all data will be
                permanently lost.
              </Text>
            </Box>
            <Button colorStyle="error" onClick={deleteApp}>
              Delete
            </Button>
          </C.ActionContainer>
        </Flex>
      ) : (
        <Box marginTop={"50px"} height={"100vh"} bg={colors.basePrimary}>
          <Text>Loading...</Text>
        </Box>
      )}
    </>
  );
};

ProjectDetails.propTypes = {
  appID: PropTypes.string.isRequired
};

ProjectDetails.displayName = "ProjectDetails";
export default ProjectDetails;