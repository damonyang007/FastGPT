import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  ModalFooter,
  ModalBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useTheme,
  Input,
  IconButton,
  Select
} from '@chakra-ui/react';
import {
  getUserInfo,
  addUserInfo,
  updateUserInfo,
  delUserByID,
  changeUserStatusById,
  getRoles
} from '@/web/support/user/api';
import { useQuery } from '@tanstack/react-query';
import { useLoading } from '@fastgpt/web/hooks/useLoading';
import dayjs from 'dayjs';
import { AddIcon, ArrowBackIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useForm } from 'react-hook-form';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import MyMenu from '@fastgpt/web/components/common/MyMenu';
import { UserStatusEnum, userStatusMap } from '@fastgpt/global/support/user/constant';

const defaultEditData: any = {
  username: '',
  nickname: '',
  roleId: '',
  manager: 0
};
const UserList = () => {
  const { t } = useTranslation();
  const { Loading } = useLoading();
  const theme = useTheme();
  const { feConfigs } = useSystemStore();
  const [editData, setEditData] = useState<any>();
  const [removeId, setRemoveId] = useState<any>();
  const [searchText, setSearchText] = useState('');
  const [currentPageNum, setCurrentPageNum] = useState(1);

  const { mutate: onclickChange, isLoading: isChangeing } = useRequest({
    mutationFn: async (data: { id: string; status: string }) =>
      changeUserStatusById(data.id, data.status),
    successToast: '操作成功',
    errorToast: '操作失败',
    onSuccess() {
      refetch();
    }
  });

  const {
    data: userInfo = [],
    isLoading: isGetting,
    refetch
  } = useQuery(['getUserInfo'], () => getUserInfo());

  const { data: roles = [], isLoading: isGettingRole } = useQuery(['getRoles'], () => getRoles());

  let userData = () => {
    return userInfo
      .filter(
        (item: any, index) =>
          item.nickname.toLowerCase().includes(searchText.toLowerCase()) ||
          item.username.toLowerCase().includes(searchText.toLowerCase())
      )
      .filter(
        (item: any, index) => index >= (currentPageNum - 1) * 10 && index < currentPageNum * 10
      );
  };

  return (
    <Flex flexDirection={'column'} h={'100%'} position={'relative'}>
      <Box display={['block', 'flex']} py={[0, 3]} px={5} alignItems={'center'}>
        <Box flex={1}>
          <Flex alignItems={'flex-end'}>
            <Box fontSize={['md', 'xl']} fontWeight={'bold'}>
              用户管理
            </Box>
          </Flex>
          <Box fontSize={'sm'} color={'myGray.600'}>
            {'管理账户信息'}
          </Box>
        </Box>
        <Box>
          <Input
            placeholder="搜索"
            value={searchText}
            bg={'#fff'}
            onChange={(e) => {
              setSearchText(e.currentTarget.value);
              setCurrentPageNum(1);
            }}
          />
        </Box>
        <Box mt={[2, 0]} textAlign={'right'}>
          <Button
            ml={3}
            leftIcon={<AddIcon fontSize={'md'} />}
            variant={'whitePrimary'}
            onClick={() =>
              setEditData({
                ...defaultEditData
              })
            }
          >
            {t('common.New Create')}
          </Button>
        </Box>
      </Box>
      <TableContainer mt={2} mb={'60px'} overflowY={'auto'} position={'relative'} minH={'300px'}>
        <Table>
          <Thead>
            <Tr>
              <Th>用户ID</Th>
              <Th>用户名</Th>
              <Th>角色</Th>
              <Th>状态</Th>
              <Th>是否管理员</Th>
              <Th>{t('common.Create Time')}</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody fontSize={'sm'}>
            {userData().map(({ _id, username, nickname, status, roleId, manager, createTime }) => (
              <Tr key={_id}>
                <Td>{username}</Td>
                <Td>{nickname}</Td>
                <Td>
                  {roles.filter((item: any) => item._id == roleId).map((item: any) => item.name)}
                </Td>
                <Td>{t(`${(userStatusMap[status] as any).label}`)}</Td>
                <Td>{manager == 1 ? '是' : '否'}</Td>
                <Td whiteSpace={'pre-wrap'}>{dayjs(createTime).format('YYYY/MM/DD\nHH:mm:ss')}</Td>
                <Td>
                  <MyMenu
                    offset={[-50, 5]}
                    Button={
                      <IconButton
                        icon={<MyIcon name={'more'} w={'14px'} />}
                        name={'more'}
                        variant={'whitePrimary'}
                        size={'sm'}
                        aria-label={''}
                      />
                    }
                    menuList={[
                      {
                        label: t('common.Edit'),
                        icon: 'edit',
                        onClick: () =>
                          setEditData({
                            _id,
                            username,
                            nickname,
                            roleId,
                            manager
                          })
                      },
                      {
                        label: status == UserStatusEnum.active ? '注销' : '激活',
                        icon: 'edit',
                        onClick: () => onclickChange({ id: _id, status: status })
                      },
                      {
                        label: t('common.Delete'),
                        icon: 'delete',
                        type: 'danger',
                        onClick: () =>
                          setRemoveId({
                            _id,
                            desc: `确认删除该用户(${nickname})信息？删除后将立即生效，删除请确认！`
                          })
                      }
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <Loading loading={isGetting || isChangeing || isGettingRole} fixed={false} />
      </TableContainer>
      <Flex
        position={'absolute'}
        bottom={'5px'}
        w={'100%'}
        p={5}
        alignItems={'center'}
        justifyContent={'flex-end'}
      >
        <Box ml={3}>
          <Flex alignItems={'center'} justifyContent={'end'}>
            <IconButton
              isDisabled={currentPageNum === 1}
              icon={<ArrowBackIcon />}
              aria-label={'left'}
              size={'smSquare'}
              onClick={() => {
                setCurrentPageNum(currentPageNum - 1);
              }}
            />
            <Flex mx={2} alignItems={'center'}>
              {t('modelCenter.pagePre')}&nbsp;
              <Input
                value={currentPageNum}
                w={'50px'}
                h={'30px'}
                size={'xs'}
                type={'number'}
                min={1}
                onChange={(e) => {
                  let val = e.target.value;
                  if (parseInt(val) <= 0) {
                    setCurrentPageNum(1);
                  } else {
                    let totalPage = Math.ceil(userInfo.length / 10);
                    setCurrentPageNum(parseInt(val) >= totalPage ? totalPage : parseInt(val));
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (val === currentPageNum) return;
                  if (val < 1) {
                    setCurrentPageNum(1);
                  } else {
                    setCurrentPageNum(val - 1);
                  }
                }}
              />
              &nbsp;{t('modelCenter.pageSuf')}
            </Flex>
            <IconButton
              isDisabled={userInfo.length <= currentPageNum * 10}
              icon={<ArrowForwardIcon />}
              aria-label={'left'}
              size={'sm'}
              w={'28px'}
              h={'28px'}
              onClick={() => {
                setCurrentPageNum(currentPageNum + 1);
              }}
            />
          </Flex>
        </Box>
      </Flex>
      {!!editData && (
        <EditModal
          defaultData={editData}
          onClose={() => setEditData(undefined)}
          onCreate={(id) => {
            refetch();
            setEditData(undefined);
          }}
          onEdit={() => {
            refetch();
            setEditData(undefined);
          }}
        />
      )}
      {!!removeId && (
        <ConfirmModal
          data={removeId}
          onClose={() => {
            setRemoveId(undefined);
            refetch();
          }}
        />
      )}
    </Flex>
  );
};

export default UserList;

// edit link modal
function EditModal({
  defaultData,
  onClose,
  onCreate,
  onEdit
}: {
  defaultData: any;
  onClose: () => void;
  onCreate: (id: string) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { Loading } = useLoading();
  const isEdit = useMemo(() => !!defaultData._id, [defaultData]);

  const {
    register,
    setValue,
    handleSubmit: submitShareChat
  } = useForm({
    defaultValues: defaultData
  });

  const { mutate: onclickCreate, isLoading: creating } = useRequest({
    mutationFn: async (e: any) => addUserInfo(e),
    errorToast: '新建用户异常',
    onSuccess: onCreate
  });
  const { mutate: onclickUpdate, isLoading: updating } = useRequest({
    mutationFn: (e: any) => updateUserInfo(e),
    errorToast: '更新用户异常',
    onSuccess: onEdit
  });

  const {
    data: roles = [],
    isLoading: isGetting,
    refetch
  } = useQuery(['getRoles'], () => getRoles());

  return (
    <MyModal isOpen={true} iconSrc="/imgs/modal/key.svg" title={isEdit ? '编辑用户' : '创建用户'}>
      <ModalBody>
        <Flex alignItems={'center'}>
          <Box flex={'0 0 90px'}>{'账户名'}:</Box>
          <Input
            disabled={isEdit}
            placeholder={'请输入用户登录账户'}
            maxLength={20}
            {...register('username', {
              required: 'username is empty'
            })}
          />
        </Flex>
        <Flex alignItems={'center'} mt={4}>
          <Box flex={'0 0 90px'}>{'昵称'}:</Box>
          <Input
            placeholder={'请输入用户昵称'}
            maxLength={20}
            {...register('nickname', {
              required: 'nickname is empty'
            })}
          />
        </Flex>
        <Flex alignItems={'center'} mt={4}>
          <Box flex={'0 0 90px'}>{'角色'}:</Box>
          <Select {...register('roleId')}>
            {roles.map(({ _id, name }) => (
              <option value={_id} key={_id}>
                {name}
              </option>
            ))}
          </Select>
        </Flex>
        <Flex alignItems={'center'} mt={4}>
          <Box flex={'0 0 90px'}>{'是否管理员'}:</Box>
          <Select
            {...register('manager', {
              required: 'manager is empty'
            })}
          >
            <option value={0}>否</option>
            <option value={1}>是</option>
          </Select>
        </Flex>
      </ModalBody>

      <ModalFooter>
        <Button variant={'whiteBase'} mr={3} onClick={onClose}>
          {t('common.Close')}
        </Button>

        <Button
          isLoading={creating || updating}
          onClick={submitShareChat((data) =>
            isEdit ? onclickUpdate({ ...data, id: defaultData?._id }) : onclickCreate(data)
          )}
        >
          {t('common.Confirm')}
        </Button>
      </ModalFooter>
      <Loading loading={isGetting} fixed={false} />
    </MyModal>
  );
}

const ConfirmModal = ({ data, onClose }: { data: any; onClose: () => void }) => {
  const { t } = useTranslation();
  const { Loading } = useLoading();
  const { mutate: onclickRemove, isLoading: isDeleting } = useRequest({
    mutationFn: async (id: string) => delUserByID(id),
    successToast: '删除成功',
    errorToast: '删除失败',
    onSuccess: onClose
  });
  return (
    <MyModal
      isOpen={true}
      onClose={onClose}
      iconSrc={'common/confirm/deleteTip'}
      title={t('common.Delete Warning')}
      maxW={['90vw', '500px']}
    >
      <ModalBody pt={5}>{data.desc}</ModalBody>
      <ModalFooter>
        <Button variant={'whiteBase'} onClick={onClose}>
          {t('common.Close')}
        </Button>

        <Button
          isLoading={isDeleting}
          bg={'red.600'}
          ml={4}
          onClick={() => onclickRemove(data._id)}
        >
          {t('common.Confirm')}
        </Button>
      </ModalFooter>
      <Loading fixed={false} />
    </MyModal>
  );
};
