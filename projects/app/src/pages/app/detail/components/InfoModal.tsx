import React, { useState, useCallback } from 'react';
import {
  Box,
  Flex,
  Button,
  FormControl,
  Input,
  Textarea,
  ModalFooter,
  ModalBody,
  Image
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { AppSchema } from '@fastgpt/global/core/app/type.d';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSelectFile } from '@/web/common/file/hooks/useSelectFile';
import { compressImgFileAndUpload } from '@/web/common/file/controller';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import Avatar from '@/components/Avatar';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useAppStore } from '@/web/core/app/store/useAppStore';
import PermissionRadio from '@/components/support/permission/Radio';
import { useTranslation } from 'next-i18next';
import { MongoImageTypeEnum } from '@fastgpt/global/common/file/image/constants';
import { ModelType, AppSortType } from '@fastgpt/global/support/permission/constant';
import { useUserStore } from '@/web/support/user/useUserStore';
import MyRadio from '@/components/common/MyRadio';

const InfoModal = ({
  defaultApp,
  onClose,
  onSuccess
}: {
  defaultApp: AppSchema;
  onClose: () => void;
  onSuccess?: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { updateAppDetail } = useAppStore();
  const { userInfo } = useUserStore();

  const { File, onOpen: onOpenSelectFile } = useSelectFile({
    fileType: '.jpg,.png',
    multiple: false
  });
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
    handleSubmit
  } = useForm({
    defaultValues: defaultApp
  });
  const [refresh, setRefresh] = useState(false);

  // submit config
  const { mutate: saveSubmitSuccess, isLoading: btnLoading } = useRequest({
    mutationFn: async (data: AppSchema) => {
      await updateAppDetail(data._id, {
        name: data.name,
        avatar: data.avatar,
        intro: data.intro,
        permission: data.permission,
        isShow: data.isShow,
        appType: data.appType
      });
    },
    onSuccess() {
      onSuccess && onSuccess();
      onClose();
      toast({
        title: t('common.Update Success'),
        status: 'success'
      });
    },
    errorToast: t('common.Update Failed')
  });

  const saveSubmitError = useCallback(() => {
    // deep search message
    const deepSearch = (obj: any): string => {
      if (!obj) return t('common.Submit failed');
      if (!!obj.message) {
        return obj.message;
      }
      return deepSearch(Object.values(obj)[0]);
    };
    toast({
      title: deepSearch(errors),
      status: 'error',
      duration: 4000,
      isClosable: true
    });
  }, [errors, t, toast]);

  const saveUpdateModel = useCallback(
    () => handleSubmit((data) => saveSubmitSuccess(data), saveSubmitError)(),
    [handleSubmit, saveSubmitError, saveSubmitSuccess]
  );

  const onSelectFile = useCallback(
    async (e: File[]) => {
      const file = e[0];
      if (!file) return;
      try {
        const src = await compressImgFileAndUpload({
          type: MongoImageTypeEnum.appAvatar,
          file,
          maxW: 300,
          maxH: 300
        });
        setValue('avatar', src);
        setRefresh((state) => !state);
      } catch (err: any) {
        toast({
          title: getErrText(err, t('common.error.Select avatar failed')),
          status: 'warning'
        });
      }
    },
    [setValue, t, toast]
  );

  return (
    <MyModal
      isOpen={true}
      onClose={onClose}
      iconSrc="/imgs/workflow/ai.svg"
      title={t('core.app.setting')}
    >
      <ModalBody>
        <Box>{t('core.app.Name and avatar')}</Box>
        <Flex mt={2} alignItems={'center'}>
          <Avatar
            src={getValues('avatar')}
            w={['26px', '34px']}
            h={['26px', '34px']}
            cursor={'pointer'}
            borderRadius={'md'}
            mr={4}
            title={t('common.Set Avatar')}
            onClick={() => onOpenSelectFile()}
          />
          <FormControl>
            <Input
              bg={'myWhite.600'}
              placeholder={t('core.app.Set a name for your app')}
              {...register('name', {
                required: true
              })}
            ></Input>
          </FormControl>
        </Flex>
        <Box mt={4} mb={1}>
          {t('core.app.App intro')}
        </Box>
        {/* <Box color={'myGray.500'} mb={2} fontSize={'sm'}>
            该介绍主要用于记忆和在应用市场展示
          </Box> */}
        <Textarea
          rows={4}
          maxLength={500}
          placeholder={t('core.app.Make a brief introduction of your app')}
          bg={'myWhite.600'}
          {...register('intro')}
        />
        {false && (
          <Box mt={4}>
            <Box mb={1}>{t('user.Permission')}</Box>
            <PermissionRadio
              value={getValues('permission')}
              onChange={(e) => {
                setValue('permission', e);
                setRefresh(!refresh);
              }}
            />
          </Box>
        )}
        {userInfo?.manager == 1 && (
          <>
            <Box mt={4}>
              <Box mb={1}>应用范围</Box>
              <MyRadio
                gridTemplateColumns={['repeat(1,1fr)', 'repeat(2,1fr)', 'repeat(3,1fr)']}
                list={[
                  {
                    icon: 'core/app/aiLight',
                    title: '我的应用',
                    desc: '',
                    value: ModelType.MINE
                  },
                  {
                    icon: 'core/explore/exploreLight',
                    title: '探索',
                    desc: '',
                    value: ModelType.EXPLORE
                  },
                  {
                    icon: 'model',
                    title: '模型库',
                    desc: '',
                    value: ModelType.MODEL_BASE
                  }
                ]}
                value={getValues('isShow')}
                onChange={(e) => {
                  setValue('isShow', e);
                  setRefresh(!refresh);
                }}
              />
            </Box>
            <Box mt={4}>
              <Box mb={1}>应用分类</Box>
              <MyRadio
                gridTemplateColumns={['repeat(1,1fr)', 'repeat(2,1fr)', 'repeat(3,1fr)']}
                list={[
                  {
                    icon: 'core/explore/exploreLight',
                    title: '个人',
                    desc: '',
                    value: AppSortType.PERSON
                  },
                  {
                    icon: 'core/app/aiLight',
                    title: '公司',
                    desc: '',
                    value: AppSortType.COMPANY
                  }
                ]}
                value={getValues('appType')}
                onChange={(e) => {
                  setValue('appType', e);
                  setRefresh(!refresh);
                }}
              />
            </Box>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant={'whiteBase'} mr={3} onClick={onClose}>
          {t('common.Close')}
        </Button>
        <Button isLoading={btnLoading} onClick={saveUpdateModel}>
          {t('common.Save')}
        </Button>
      </ModalFooter>

      <File onSelect={onSelectFile} />
    </MyModal>
  );
};

export default React.memo(InfoModal);
